import { google } from "googleapis";

export interface PriceEntry {
  product: string;
  type: string;
  storage: string;
  shop: string;
  price: string | null;
  link: string | null;
  category: "iPhone" | "Android";
}

export interface HistoryRow {
  timestamp: string;
  product: string;
  type: string;
  storage: string;
  shop: string;
  price: string;
  link: string;
  price_change: string;
}

const IPHONE_SHOPS = ["Asmart", "Di Động Xanh", "Click Buy", "Chung Mobile"];
const ANDROID_SHOPS = ["Asmart", "Mobile City", "Click Buy", "Alo Việt"];

// Rows to skip when parsing the source sheet
const SKIP_VALUES = new Set([
  "", "dòng", "loại", "dung lượng", "iphone", "android",
  "hàng mới", "hàng cũ", "flash sale", "khuyến mãi", "sắp về",
]);

function isSkippable(val: string): boolean {
  return SKIP_VALUES.has(val.toLowerCase().trim());
}

// Sheet stores prices in "thousands" format (e.g., "34.390" means 34,390,000 VND)
// Convert to full VND with proper formatting
function normalizeSheetPrice(raw: string | null): string | null {
  if (!raw) return null;
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const num = parseInt(digitsOnly, 10);
  if (isNaN(num) || num <= 0) return null;
  // If value is less than 1M, assume sheet format is in thousands
  const fullVnd = num < 1_000_000 ? num * 1000 : num;
  return fullVnd.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const key = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function readPriceSheet(): Promise<PriceEntry[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.SOURCE_SHEET_ID!;

  const res = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    includeGridData: true,
  });

  const sheet = res.data.sheets?.[0];
  const rows = sheet?.data?.[0]?.rowData ?? [];
  const entries: PriceEntry[] = [];

  // Track last seen product/type for merged cells (same product spans multiple rows)
  let lastIphoneProduct = "";
  let lastIphoneType = "";
  let lastAndroidProduct = "";
  let lastAndroidType = "";

  for (const row of rows) {
    const cells = row.values ?? [];

    // iPhone side: cols 0-6
    const rawIphoneProduct = cells[0]?.formattedValue ?? "";
    const rawIphoneType = cells[1]?.formattedValue ?? "";
    const iphoneStorage = cells[2]?.formattedValue ?? "";

    // Carry forward merged cell values
    if (rawIphoneProduct && !isSkippable(rawIphoneProduct)) {
      lastIphoneProduct = rawIphoneProduct;
    }
    if (rawIphoneType && !isSkippable(rawIphoneType)) {
      lastIphoneType = rawIphoneType;
    }

    // Only process if we have a storage (indicates a real data row)
    if (iphoneStorage && !isSkippable(iphoneStorage) && lastIphoneProduct) {
      IPHONE_SHOPS.forEach((shop, i) => {
        const cell = cells[3 + i];
        const price = normalizeSheetPrice(cell?.formattedValue ?? null);
        const link = cell?.hyperlink ?? null;
        if (price || link) {
          entries.push({
            product: lastIphoneProduct,
            type: lastIphoneType,
            storage: iphoneStorage,
            shop,
            price,
            link,
            category: "iPhone",
          });
        }
      });
    }

    // Android side: cols 8-14 (col 7 is separator)
    const rawAndroidProduct = cells[8]?.formattedValue ?? "";
    const rawAndroidType = cells[9]?.formattedValue ?? "";
    const androidStorage = cells[10]?.formattedValue ?? "";

    if (rawAndroidProduct && !isSkippable(rawAndroidProduct)) {
      lastAndroidProduct = rawAndroidProduct;
    }
    if (rawAndroidType && !isSkippable(rawAndroidType)) {
      lastAndroidType = rawAndroidType;
    }

    if (androidStorage && !isSkippable(androidStorage) && lastAndroidProduct) {
      ANDROID_SHOPS.forEach((shop, i) => {
        const cell = cells[11 + i];
        const price = normalizeSheetPrice(cell?.formattedValue ?? null);
        const link = cell?.hyperlink ?? null;
        if (price || link) {
          entries.push({
            product: lastAndroidProduct,
            type: lastAndroidType,
            storage: androidStorage,
            shop,
            price,
            link,
            category: "Android",
          });
        }
      });
    }
  }

  return entries;
}

// Get last scraped prices for comparison (from Log tab)
export async function getLastPrices(): Promise<Map<string, string>> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.HISTORY_SHEET_ID!;
  const map = new Map<string, string>();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Log!A:H",
    });
    const rows = res.data.values ?? [];
    for (const row of rows) {
      if (row.length < 6 || row[1] === "product") continue;
      const [, product, type, storage, shop, price] = row;
      map.set(`${product}|${type}|${storage}|${shop}`, price);
    }
  } catch {
    // Log tab might not exist yet
  }
  return map;
}

// Write current prices to history sheet in source-like format
// Also append a flat log entry for history tracking
export async function writeHistorySheet(
  data: Array<{
    product: string; type: string; storage: string; shop: string;
    price: string | null; link: string | null; category: string; priceChange: string; scrapeError?: string | null;
  }>,
  timestamp: string
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = process.env.HISTORY_SHEET_ID!;

  // Ensure both tabs exist
  await ensureTabs(sheets, sheetId);

  // 1. Overwrite "Giá hiện tại" tab in source format
  await writeCurrentPricesTab(sheets, sheetId, data, timestamp);

  // 2. Append to "Log" tab
  await appendLogTab(sheets, sheetId, data, timestamp);
}

async function ensureTabs(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTabs = (res.data.sheets ?? []).map((s) => s.properties?.title ?? "");

  const requests = [];
  if (!existingTabs.includes("Giá hiện tại")) {
    requests.push({ addSheet: { properties: { title: "Giá hiện tại" } } });
  }
  if (!existingTabs.includes("Log")) {
    requests.push({ addSheet: { properties: { title: "Log" } } });
  }
  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests },
    });
  }
}

async function writeCurrentPricesTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  data: Array<{
    product: string; type: string; storage: string; shop: string;
    price: string | null; link: string | null; category: string; priceChange: string; scrapeError?: string | null;
  }>,
  timestamp: string
) {
  // Build rows in source format
  const rows: string[][] = [];

  rows.push([`Cập nhật lúc: ${new Date(timestamp).toLocaleString("vi-VN")}`]);
  rows.push([]); // empty separator

  // iPhone section
  rows.push(["IPHONE"]);
  rows.push(["Dòng", "Loại", "Dung Lượng", ...IPHONE_SHOPS]);

  const iphoneData = data.filter((d) => d.category === "iPhone");
  const iphoneGroups = groupByProduct(iphoneData, IPHONE_SHOPS);
  for (const g of iphoneGroups) {
    rows.push([
      g.product,
      g.type,
      g.storage,
      ...IPHONE_SHOPS.map((s) => g.shops[s]?.price ?? ""),
    ]);
  }

  rows.push([]); // separator

  // Android section
  rows.push(["ANDROID"]);
  rows.push(["Dòng", "Loại", "Dung Lượng", ...ANDROID_SHOPS]);

  const androidData = data.filter((d) => d.category === "Android");
  const androidGroups = groupByProduct(androidData, ANDROID_SHOPS);
  for (const g of androidGroups) {
    rows.push([
      g.product,
      g.type,
      g.storage,
      ...ANDROID_SHOPS.map((s) => g.shops[s]?.price ?? ""),
    ]);
  }

  // Clear and rewrite
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "Giá hiện tại!A:Z",
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "Giá hiện tại!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

async function appendLogTab(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  data: Array<{
    product: string; type: string; storage: string; shop: string;
    price: string | null; priceChange: string; link: string | null; category: string;
  }>,
  timestamp: string
) {
  // Ensure header
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Log!A1:H1",
    });
    if (!res.data.values?.[0]?.[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Log!A1:H1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["timestamp", "product", "type", "storage", "shop", "price", "link", "price_change"]],
        },
      });
    }
  } catch {}

  const logRows = data
    .filter((d) => d.price)
    .map((d) => [
      timestamp,
      d.product,
      d.type,
      d.storage,
      d.shop,
      d.price ?? "",
      d.link ?? "",
      d.priceChange,
    ]);

  if (logRows.length === 0) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Log!A:H",
    valueInputOption: "RAW",
    requestBody: { values: logRows },
  });
}

function groupByProduct(
  data: Array<{ product: string; type: string; storage: string; shop: string; price: string | null }>,
  shops: string[]
) {
  const map = new Map<string, { product: string; type: string; storage: string; shops: Record<string, { price: string | null }> }>();
  for (const d of data) {
    const key = `${d.product}|${d.type}|${d.storage}`;
    if (!map.has(key)) {
      map.set(key, {
        product: d.product, type: d.type, storage: d.storage,
        shops: Object.fromEntries(shops.map((s) => [s, { price: null }])),
      });
    }
    map.get(key)!.shops[d.shop] = { price: d.price };
  }
  return Array.from(map.values());
}
