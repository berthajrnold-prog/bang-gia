import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/samsung-s24-plus-cu.html", storage: "256GB", note: "CB S24+ 99% 256" },
  { url: "https://clickbuy.com.vn/samsung-s24-plus-cu.html", storage: "512GB", note: "CB S24+ 99% 512" },
  { url: "https://mobilecity.vn/dien-thoai/samsung-galaxy-s24-plus-cu-dep-nhu-moi.html", storage: "12/256", note: "MC S24+ 12/256" },
  { url: "https://mobilecity.vn/dien-thoai/samsung-galaxy-s24-plus-cu-dep-nhu-moi.html", storage: "12/512", note: "MC S24+ 12/512" },
];

for (const t of tests) {
  const start = Date.now();
  const p = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.note}: ${p} [${Date.now() - start}ms]`);
}

await closeBrowser();
process.exit(0);
