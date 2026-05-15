import { fetchHtmlWithBrowser } from "./browser";
import { formatVNPrice } from "./common";
import { chromium } from "playwright";

const DA_NANG_COOKIES = [
  { name: "khu_vuc", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
  { name: "region", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
];

// Custom scraper: click "99%" condition, iterate colors, return lowest price
export async function scrapeDidongxanh(url: string, _storage?: string): Promise<string | null> {
  void _storage;

  // Reuse the singleton browser via fetchHtmlWithBrowser approach
  // But for DDX we need active interaction, so use a dedicated context
  const browser = (globalThis as { __scraperBrowser?: import("playwright").Browser }).__scraperBrowser
    ?? (await chromium.launch({ headless: true, args: ["--no-sandbox"] }));
  if (!(globalThis as { __scraperBrowser?: import("playwright").Browser }).__scraperBrowser) {
    (globalThis as { __scraperBrowser?: import("playwright").Browser }).__scraperBrowser = browser;
  }

  const ctx = await browser.newContext({
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  await ctx.addCookies(DA_NANG_COOKIES);

  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (["image", "font", "media", "stylesheet"].includes(t)) return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".product-price .text-price", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Step 1: Click "99%" condition
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div[class*="options_"]'));
      for (const div of all) {
        if (div.textContent?.trim() === "99%") {
          (div as HTMLElement).click();
          return;
        }
      }
    });
    await page.waitForTimeout(800);

    // Step 2: Find color buttons and iterate
    const colorTexts: string[] = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll("*"))
        .filter((el) => el.textContent?.trim() === "Màu Sắc" && el.children.length === 0);
      if (labels.length === 0) return [];
      let container = labels[0].parentElement;
      for (let i = 0; i < 5; i++) {
        const opts = container?.querySelectorAll('button, [class*="options_"]');
        if (opts && opts.length >= 1) {
          return Array.from(opts)
            .map((b) => b.textContent?.trim() ?? "")
            .filter((t) => t && t.length < 50);
        }
        container = container?.parentElement ?? null;
      }
      return [];
    });

    const prices: number[] = [];
    if (colorTexts.length === 0) {
      // No colors found, just return current price
      const txt = await page.locator(".product-price .text-price").first().textContent();
      const n = parseInt((txt ?? "").replace(/[^0-9]/g, ""), 10);
      if (n >= 1_000_000) prices.push(n);
    } else {
      for (const color of colorTexts) {
        await page.evaluate((c) => {
          const all = Array.from(document.querySelectorAll('button, [class*="options_"]'));
          for (const el of all) {
            if (el.textContent?.trim() === c) {
              (el as HTMLElement).click();
              return;
            }
          }
        }, color);
        await page.waitForTimeout(500);
        const txt = await page.locator(".product-price .text-price").first().textContent();
        const n = parseInt((txt ?? "").replace(/[^0-9]/g, ""), 10);
        if (n >= 1_000_000 && n <= 200_000_000) prices.push(n);
      }
    }

    if (prices.length === 0) return null;
    const lowest = Math.min(...prices);
    return formatVNPrice(String(lowest));
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Suppress unused import warning
void fetchHtmlWithBrowser;
