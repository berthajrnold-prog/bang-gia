import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://didongxanh.com.vn/iphone-17-256gb-chinh-hang", expected: "23.800.000" },
  { url: "https://didongxanh.com.vn/iphone-17-512gb-chinh-hang", expected: "29.900.000" },
  { url: "https://chungmobile.com/product/iphone-16-hang-loai-b-qua-tang-len-den-2-trieu/", storage: "256GB", expected: "18.000.000" },
];

for (const t of tests) {
  const start = Date.now();
  const price = await scrapePrice(t.url, { storage: t.storage });
  const ms = Date.now() - start;
  const ok = price === t.expected ? "✓" : "✗";
  console.log(`${ok} ${t.url} → ${price} (expected ${t.expected}) [${ms}ms]`);
}

await closeBrowser();
