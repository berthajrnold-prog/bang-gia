import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const url = "https://clickbuy.com.vn/samsung-galaxy-s25-ultra.html";
for (const storage of ["256GB", "512GB", "1TB"]) {
  const p = await scrapePrice(url, { storage });
  console.log(storage, "→", p);
}
await closeBrowser();
process.exit(0);
