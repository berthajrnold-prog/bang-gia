// Scrape every Viettel link in the sheet and compare with the sheet price
import { readPriceSheet } from "../lib/sheets.ts";
import { scrapePrice } from "../lib/scrapers/index.ts";

const entries = (await readPriceSheet()).filter((e) => e.shop === "Viettel" && e.link);
let ok = 0;
for (const e of entries) {
  const p = await scrapePrice(e.link, { storage: e.storage });
  if (p) ok++;
  console.log(`${p ? (p === e.price ? "✓" : "≈") : "✗"} ${e.product} ${e.storage}: sheet=${e.price} scraped=${p}`);
}
console.log(`\n${ok}/${entries.length} có giá`);
process.exit(0);
