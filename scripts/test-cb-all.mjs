import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const tests = [
  { url: "https://clickbuy.com.vn/samsung-galaxy-s23-cu.html", storage: "128GB", note: "S23 (no variants)" },
  { url: "https://clickbuy.com.vn/samsung-galaxy-s23-cu.html", storage: "256GB", note: "S23 (no variants)" },
  { url: "https://clickbuy.com.vn/iphone-17-pro.html", storage: "256GB", note: "IP17 Pro main" },
  { url: "https://clickbuy.com.vn/iphone-17-pro.html", storage: "512GB", note: "IP17 Pro variant" },
  { url: "https://clickbuy.com.vn/samsung-galaxy-s25-ultra.html", storage: "256GB", note: "S25 Ultra main" },
  { url: "https://clickbuy.com.vn/samsung-galaxy-s25-ultra.html", storage: "512GB", note: "S25 Ultra variant" },
];

for (const t of tests) {
  const p = await scrapePrice(t.url, { storage: t.storage });
  console.log(`${t.note} ${t.storage}: ${p}`);
}
await closeBrowser();
process.exit(0);
