import { chromium, type Browser } from "playwright";
import { formatVNPrice, parseVNPrice } from "./common";

function normalizeStorage(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

// Extract just the storage number (e.g., "256GB" → "256", "12/512" → "512")
function storageNum(s: string): string | null {
  const m = s.match(/(\d+)\s*GB|(\d+)\s*TB/i);
  if (m) return m[1] || m[2];
  // Format "12/512" → take second number (storage, not RAM)
  const slash = s.match(/\d+\/(\d+)/);
  if (slash) return slash[1];
  return null;
}

export async function scrapeMobileCity(url: string, storage?: string): Promise<string | null> {
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

  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (["image", "font", "media", "stylesheet"].includes(t)) return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Try to click matching storage button if requested
    if (storage) {
      const wantedNum = storageNum(storage);
      if (wantedNum) {
        const clicked = await page.evaluate((num) => {
          const buttons = Array.from(document.querySelectorAll("[data-storage_id]"));
          for (const btn of buttons) {
            const txt = btn.textContent?.trim() ?? "";
            if (txt.includes(num)) {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, wantedNum);
        if (clicked) await page.waitForTimeout(1200);
      }
    }

    // Get current main price
    const selectors = [".product-summary-price", ".price-product .price", ".price-box .price", ".price"];
    for (const sel of selectors) {
      const txt = await page.locator(sel).first().textContent().catch(() => null);
      if (txt) {
        const parsed = parseVNPrice(txt.trim());
        if (parsed) return formatVNPrice(parsed);
      }
    }
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}
