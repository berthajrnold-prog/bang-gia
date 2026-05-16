import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/samsung-galaxy-s22-ultra-5g-8gb-128gb-cu-99.html", storage: "128GB", note: "S22 Ultra 128 → expect 8.690 (Máy 98%)" },
  { url: "https://clickbuy.com.vn/samsung-s24-plus-cu.html", storage: "256GB", note: "S24+ 256 → expect Máy 98% price" },
  { url: "https://clickbuy.com.vn/samsung-s24-plus-cu.html", storage: "512GB", note: "S24+ 512 → expect higher than 256" },
  { url: "https://clickbuy.com.vn/iphone-17.html", storage: "256GB", note: "IP17 256 (no condition variants)" },
  { url: "https://clickbuy.com.vn/iphone-17.html", storage: "512GB", note: "IP17 512" },
];

for (const t of tests) {
  const start = Date.now();
  const p = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.note}: ${p} [${Date.now() - start}ms]`);
}
await closeBrowser();
process.exit(0);
