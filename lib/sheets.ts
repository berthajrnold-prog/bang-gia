import { google } from "googleapis";
import { orderShops } from "./shops";

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

  // Locate sections from the header row ("Dòng | Loại | Dung Lượng | shop… ")
  // instead of hardcoding column numbers, so added shop columns don't break parsing.
  const headerIdx = rows.findIndex((r) =>
    (r.values ?? []).some((c) => (c.formattedValue ?? "").trim().toLowerCase() === "dòng")
  );
  if (headerIdx < 0) return entries;
  const header = (rows[headerIdx].values ?? []).map((c) => (c.formattedValue ?? "").trim());
  const titles = (rows[headerIdx - 1]?.values ?? []).map((c) => (c.formattedValue ?? "").trim().toLowerCase());

  const sections = header
    .map((h, i) => (h.toLowerCase() === "dòng" ? i : -1))
    .filter((i) => i >= 0)
    .map((start, n) => {
      const shops: Array<{ name: string; col: number }> = [];
      for (let c = start + 3; c < header.length && header[c] && header[c].toLowerCase() !== "dòng"; c++) {
        shops.push({ name: header[c], col: c });
      }
      const category: "iPhone" | "Android" =
        titles[start] === "android" ? "Android" : titles[start] === "iphone" ? "iPhone" : n === 0 ? "iPhone" : "Android";
      return { start, shops, category, lastProduct: "", lastType: "" };
    });

  for (const row of rows.slice(headerIdx + 1)) {
    const cells = row.values ?? [];
    for (const sec of sections) {
      const rawProduct = cells[sec.start]?.formattedValue ?? "";
      const rawType = cells[sec.start + 1]?.formattedValue ?? "";
      const storage = cells[sec.start + 2]?.formattedValue ?? "";

      // Carry forward merged cell values (same product spans multiple rows)
      if (rawProduct && !isSkippable(rawProduct)) sec.lastProduct = rawProduct;
      if (rawType && !isSkippable(rawType)) sec.lastType = rawType;

      // Only process if we have a storage (indicates a real data row)
      if (!storage || isSkippable(storage) || !sec.lastProduct) continue;
      for (const { name, col } of sec.shops) {
        const cell = cells[col];
        const price = normalizeSheetPrice(cell?.formattedValue ?? null);
        const link = cell?.hyperlink ?? null;
        if (price || link) {
          entries.push({
            product: sec.lastProduct,
            type: sec.lastType,
            storage,
            shop: name,
            price,
            link,
            category: sec.category,
          });
        }
      }
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

  for (const category of ["iPhone", "Android"] as const) {
    const catData = data.filter((d) => d.category === category);
    const shops = orderShops(category, catData.map((d) => d.shop));
    rows.push([category.toUpperCase()]);
    rows.push(["Dòng", "Loại", "Dung Lượng", ...shops]);
    for (const g of groupByProduct(catData, shops)) {
      rows.push([g.product, g.type, g.storage, ...shops.map((s) => g.shops[s]?.price ?? "")]);
    }
    rows.push([]); // separator
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
