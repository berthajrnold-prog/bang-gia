import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://didongxanh.com.vn/iphone-16-pro-max-1tb-cu-dep-99-zin-nguyen-ban", expected: "~28.090.000 (sheet)" },
  { url: "https://didongxanh.com.vn/iphone-17-256gb-chinh-hang", expected: "23.800.000 (sheet)" },
  { url: "https://didongxanh.com.vn/iphone-17-512gb-chinh-hang", expected: "29.900.000 (sheet)" },
];

for (const t of tests) {
  const start = Date.now();
  const price = await scrapePrice(t.url);
  console.log(`${price}  (expected ${t.expected}) [${Date.now() - start}ms]  ${t.url}`);
}

await closeBrowser();
process.exit(0);
