import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/xiaomi-poco-c85-chinh-hang.html", storage: "8/256", note: "CB Poco C85 8/256 → 3.290 (not 2.990)" },
  { url: "https://clickbuy.com.vn/xiaomi-poco-c85-chinh-hang.html", storage: "6/128", note: "CB Poco C85 6/128" },
  { url: "https://mobilecity.vn/dien-thoai/xiaomi-redmi-note-15-chinh-hang.html", storage: "6/128 - 5G", note: "MC Redmi N15 6/128 5G → 6.050" },
  { url: "https://mobilecity.vn/dien-thoai/xiaomi-redmi-note-15-chinh-hang.html", storage: "6/128 - 4G", note: "MC Redmi N15 6/128 4G → 4.750" },
];

for (const t of tests) {
  const start = Date.now();
  const p = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.note}: ${p} [${Date.now() - start}ms]`);
}
await closeBrowser();
process.exit(0);
