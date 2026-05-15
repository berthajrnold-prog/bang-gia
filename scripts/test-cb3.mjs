import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/iphone-17.html", storage: "256GB", expected: "23.990.000 (or close)" },
  { url: "https://clickbuy.com.vn/iphone-17.html", storage: "512GB", expected: "30.490.000" },
];

for (const t of tests) {
  const start = Date.now();
  const price = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.storage}: ${price} (expected ${t.expected}) [${Date.now() - start}ms]`);
}

await closeBrowser();
process.exit(0);
