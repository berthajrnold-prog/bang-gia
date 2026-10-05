// Scrape shops that block the VPS IP (FPT, TGDĐ) from this machine and push to the VPS.
// Run: double-click Cao-gia-FPT-TGDD.bat  (or: npx tsx --env-file=.env.local scripts/scrape-local.mjs)
import { readPriceSheet } from "../lib/sheets.ts";
import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";
import { LOCAL_SCRAPE_SHOPS } from "../lib/shops.ts";

const VPS_URL = process.env.VPS_URL ?? "http://45.76.162.76:3000";

const entries = (await readPriceSheet()).filter((e) => LOCAL_SCRAPE_SHOPS.includes(e.shop) && e.link);
console.log(`Đang cào ${entries.length} ô (${LOCAL_SCRAPE_SHOPS.join(", ")})...`);

const rows = [];
for (const e of entries) {
  let price = null;
  try {
    price = await scrapePrice(e.link, { storage: e.storage });
  } catch {}
  console.log(`${price ? "✓" : "✗"} ${e.shop} ${e.product} ${e.storage}: ${price ?? "lỗi"}`);
  rows.push({
    product: e.product, type: e.type, storage: e.storage, shop: e.shop, category: e.category,
    link: e.link, price, priceChange: "",
    scrapeError: price ? null : "Không tìm thấy giá trong page",
  });
}
await closeBrowser();

const res = await fetch(`${VPS_URL}/api/merge`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-merge-key": process.env.HISTORY_SHEET_ID },
  body: JSON.stringify({ rows }),
});
console.log(`\nGửi lên VPS: HTTP ${res.status}`, await res.text());
process.exit(0);
