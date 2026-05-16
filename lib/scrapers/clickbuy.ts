import * as cheerio from "cheerio";
import { chromium, type Browser } from "playwright";
import { fetchHtml, formatVNPrice, parseVNPrice } from "./common";

const DA_NANG_COOKIES = [
  { name: "city", value: "da-nang", domain: ".clickbuy.com.vn" },
  { name: "khu_vuc", value: "da-nang", domain: ".clickbuy.com.vn" },
  { name: "branch", value: "da-nang", domain: ".clickbuy.com.vn" },
  { name: "region", value: "da-nang", domain: ".clickbuy.com.vn" },
];

function normalizeStorage(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

// Extract storage label from text. Handles RAM+Storage patterns like "12GB 256GB" → returns 256GB.
// Rule: GB values < 32 are RAM (not storage). TB is always storage.
function findStorage(text: string): string | null {
  const matches = Array.from(text.matchAll(/(\d{1,4})\s*(GB|TB)/gi));
  for (let i = matches.length - 1; i >= 0; i--) {
    const [, num, unit] = matches[i];
    const n = parseInt(num, 10);
    if (unit.toUpperCase() === "TB") return normalizeStorage(`${n}TB`);
    if (n >= 32) return normalizeStorage(`${n}GB`);
  }
  return null;
}

function parsePrice(text: string): number | null {
  const m = text.match(/(\d{1,3}(?:[.,]\d{3})+)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return n >= 1_000_000 ? n : null;
}

export async function scrapeClickBuy(
  url: string,
  storage?: string
): Promise<string | null> {
  const html = await fetchHtml(url, {
    cookies: DA_NANG_COOKIES.map((c) => ({ ...c, path: "/" })),
    waitForSelector: ".related_versions__item, .js-price",
    extraWait: 1500,
  });

  const $ = cheerio.load(html);
  const wantedStorage = storage ? normalizeStorage(storage) : null;

  // Build variant map: storage → price
  const variantMap = new Map<string, number>();

  // 1. Main page = current selected variant. Get storage from title/h1
  const pageTitle = $("h1").first().text().trim() || $("title").first().text().trim();
  const mainStorage = findStorage(pageTitle);
  const mainPriceText = $(".product-price .js-price").first().text().trim()
    || $(".js-price.price").first().text().trim()
    || $(".product-price").first().text().trim();
  const mainPrice = parsePrice(mainPriceText);

  if (mainStorage && mainPrice) {
    variantMap.set(mainStorage, mainPrice);
  }

  // 2. Other variants from .related_versions__item
  $(".related_versions__item").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ");
    const st = findStorage(text);
    const dataPrice = $el.find("[data-price]").attr("data-price");
    let price: number | null = null;
    if (dataPrice) {
      const n = parseInt(dataPrice, 10);
      if (n >= 1_000_000) price = n;
    }
    if (!price) price = parsePrice(text);
    if (st && price && !variantMap.has(st)) {
      variantMap.set(st, price);
    }
  });

  // Match by wanted storage when we have variants AND found a match
  if (wantedStorage && variantMap.has(wantedStorage)) {
    return formatVNPrice(String(variantMap.get(wantedStorage)!));
  }

  // Fallback: check if page has .list-variant__item storage buttons
  // (Samsung pages don't have related_versions but have these clickable storage buttons)
  if (wantedStorage) {
    const storageButtons = $(".list-variant__item.check");
    if (storageButtons.length > 1) {
      // Need Playwright interaction — click and read updated price
      const clickedPrice = await clickStorageAndGetPrice(url, wantedStorage);
      if (clickedPrice) return clickedPrice;
    }
  }

  // Page has only one configuration → use main displayed price
  if (mainPrice) {
    return formatVNPrice(String(mainPrice));
  }

  if (variantMap.size > 0) {
    const lowest = Math.min(...variantMap.values());
    return formatVNPrice(String(lowest));
  }

  return null;
}

// Click storage variant button and read updated price (for single-URL multi-variant pages)
async function clickStorageAndGetPrice(url: string, wantedStorage: string): Promise<string | null> {
  const browser = (globalThis as { __scraperBrowser?: Browser }).__scraperBrowser
    ?? (await chromium.launch({ headless: true, args: ["--no-sandbox"] }));
  if (!(globalThis as { __scraperBrowser?: Browser }).__scraperBrowser) {
    (globalThis as { __scraperBrowser?: Browser }).__scraperBrowser = browser;
  }

  const ctx = await browser.newContext({
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  });
  await ctx.addCookies(DA_NANG_COOKIES.map((c) => ({ ...c, path: "/" })));

  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (["image", "font", "media", "stylesheet"].includes(t)) return route.abort();
      return route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Find storage button matching wantedStorage (e.g., "512gb")
    // Storage labels in DOM: "256GB", "512GB", "1TB" (raw text)
    const wantedLabel = wantedStorage.toUpperCase();
    const wantedNum = wantedLabel.match(/\d+/)?.[0];
    if (!wantedNum) return null;

    // ClickBuy uses real DOM events — must use Playwright trusted .click()
    const buttonLocator = page.locator(`p[data-name*="${wantedNum}"]`).first();
    const found = (await buttonLocator.count()) > 0;
    if (!found) return null;

    await buttonLocator.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const priceText = await page
      .locator(".product-price .js-price, .js-price.price")
      .first()
      .textContent()
      .catch(() => null);
    if (priceText) {
      const parsed = parseVNPrice(priceText.trim());
      if (parsed) return formatVNPrice(parsed);
    }
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}
