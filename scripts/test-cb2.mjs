import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/iphone-12-cu.html" },
  { url: "https://didongxanh.com.vn/iphone-17-256gb-chinh-hang", expected: "23.800.000" },
];

for (const t of tests) {
  const start = Date.now();
  const price = await scrapePrice(t.url);
  console.log(`${t.url} → ${price} [${Date.now() - start}ms]`);
}

await closeBrowser();
process.exit(0);
