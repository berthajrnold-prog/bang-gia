import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/xiaomi-redmi-note-15-pro-5g.html", storage: "12/256", note: "5G URL, sheet '12/256' (default → 4G expected: 7.990)" },
  { url: "https://clickbuy.com.vn/xiaomi-redmi-note-15-pro-5g.html", storage: "12/256 - 5G", note: "5G URL, sheet '12/256-5G' (expect 8.790)" },
  { url: "https://clickbuy.com.vn/xiaomi-redmi-note-15-pro-4g.html", storage: "12/256", note: "4G URL, sheet '12/256' (expect 7.990)" },
];

for (const t of tests) {
  const start = Date.now();
  const p = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.note}\n  → ${p} [${Date.now() - start}ms]`);
}
await closeBrowser();
process.exit(0);
