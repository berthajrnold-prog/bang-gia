import { readPriceSheet } from "../lib/sheets.ts";
import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";

const entries = await readPriceSheet();
const counts = {};
for (const e of entries) counts[`${e.category}/${e.shop}`] = (counts[`${e.category}/${e.shop}`] ?? 0) + 1;
console.log("Entries per category/shop:", counts);
console.log("Sample Android:", entries.filter((e) => e.category === "Android").slice(0, 2));

const NEW = ["FPT", "TGDĐ", "Viettel", "Chợ lớn"];
let ok = 0, total = 0;
for (const e of entries.filter((e) => NEW.includes(e.shop) && e.link)) {
  total++;
  const p = await scrapePrice(e.link, { storage: e.storage });
  const match = p === e.price;
  if (match) ok++;
  console.log(`${match ? "✓" : "✗"} ${e.shop.padEnd(8)} ${e.product} ${e.type} ${e.storage}: sheet=${e.price} scraped=${p}`);
}
console.log(`\n${ok}/${total} khớp sheet`);
await closeBrowser();
process.exit(0);
