import { chromium, type Browser } from "playwright";
import { formatVNPrice, parseVNPrice } from "./common";

const DA_NANG_COOKIES = [
  { name: "city", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" },
  { name: "khu_vuc", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" },
  { name: "branch", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" },
  { name: "region", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" },
];

export async function scrapeClickBuy(
  url: string,
  storage?: string
): Promise<string | null> {
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
  await ctx.addCookies(DA_NANG_COOKIES);

  try {
    const page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const t = route.request().resourceType();
      if (["image", "font", "media", "stylesheet"].includes(t)) return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    // Step 1: Find cheapest condition variant (e.g., "Máy 98%", "Máy 95%")
    // These appear in .list-variant__item with format "Máy NN% [price]"
    const conditions: Array<{ label: string; price: number }> = await page.evaluate(() => {
      const variants = Array.from(document.querySelectorAll(".list-variant__item"));
      const out: Array<{ label: string; price: number }> = [];
      for (const v of variants) {
        const text = (v.textContent || "").replace(/\s+/g, " ").trim();
        const m = text.match(/^(Máy\s+\d+\+?%)\s+(\d{1,3}(?:[.,]\d{3})+)/i);
        if (m) {
          const n = parseInt(m[2].replace(/[.,]/g, ""), 10);
          if (n >= 1_000_000) out.push({ label: m[1], price: n });
        }
      }
      return out;
    });

    if (conditions.length > 0) {
      const cheapest = conditions.sort((a, b) => a.price - b.price)[0];
      await page
        .locator(`.list-variant__item:has-text("${cheapest.label}")`)
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Step 2: Check .related_versions__item cards for storage-specific prices
    // (iPhone-style pages have these with data-price reflecting current condition)
    if (storage) {
      const wantedNum = storage.match(/\d+/)?.[0];
      const wantedIsTB = /TB/i.test(storage);
      if (wantedNum) {
        const variantPrice = await page.evaluate(
          ({ num, isTB }) => {
            const cards = Array.from(document.querySelectorAll(".related_versions__item"));
            for (const card of cards) {
              const txt = (card.textContent || "").replace(/\s+/g, " ");
              // Match storage in card text (e.g., "256GB" or "1TB")
              const unit = isTB ? "TB" : "GB";
              const re = new RegExp(`\\b${num}\\s*${unit}\\b`, "i");
              if (re.test(txt)) {
                const dp = card.querySelector("[data-price]")?.getAttribute("data-price");
                if (dp) return parseInt(dp, 10);
                const pm = txt.match(/(\d{1,3}(?:[.,]\d{3})+)/);
                if (pm) return parseInt(pm[1].replace(/[.,]/g, ""), 10);
              }
            }
            return null;
          },
          { num: wantedNum, isTB: wantedIsTB }
        );
        if (variantPrice && variantPrice >= 1_000_000) {
          return formatVNPrice(String(variantPrice));
        }

        // Step 3: Fallback — click storage button (.list-variant__item.check)
        const label = wantedIsTB ? `${wantedNum}TB` : `${wantedNum}GB`;
        const storageLocator = page.locator(`p[data-name="${label}"]`).first();
        if ((await storageLocator.count()) > 0) {
          await storageLocator.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      }
    }

    // Step 4: Get current displayed price (main)
    const selectors = [".product-price .js-price", ".js-price.price", ".product-price"];
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
