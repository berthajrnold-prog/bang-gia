// Compare scraped prices vs sheet prices for every entry, output a report
import "dotenv/config";
import { readPriceSheet } from "../lib/sheets.ts";
import { scrapePrice } from "../lib/scrapers/index.ts";
import { closeBrowser } from "../lib/scrapers/browser.ts";
import { writeFileSync } from "fs";

const entries = await readPriceSheet();
console.log(`Total entries: ${entries.length}`);
const withLink = entries.filter((e) => e.link);
console.log(`With link: ${withLink.length}`);

const results = [];
let i = 0;
const BATCH_SIZE = 3;

for (let b = 0; b < withLink.length; b += BATCH_SIZE) {
  const batch = withLink.slice(b, b + BATCH_SIZE);
  const batchRes = await Promise.all(
    batch.map(async (e) => {
      const start = Date.now();
      let scraped = null;
      let err = null;
      try {
        scraped = await scrapePrice(e.link, { storage: e.storage });
      } catch (ex) {
        err = String(ex).slice(0, 80);
      }
      const sheetN = e.price ? parseInt(e.price.replace(/\./g, ""), 10) : null;
      const scrapedN = scraped ? parseInt(scraped.replace(/\./g, ""), 10) : null;
      const diff = sheetN && scrapedN ? scrapedN - sheetN : null;
      return {
        product: e.product,
        type: e.type,
        storage: e.storage,
        shop: e.shop,
        category: e.category,
        sheet: e.price,
        scraped,
        diff,
        diffPct: sheetN && diff ? Math.round((diff / sheetN) * 100) : null,
        err,
        ms: Date.now() - start,
      };
    })
  );
  results.push(...batchRes);
  i += batch.length;
  console.log(`[${i}/${withLink.length}]`);
}

await closeBrowser();

// Save full report
writeFileSync("./scripts/audit-result.json", JSON.stringify(results, null, 2));

// Summary by shop
const byShop = {};
for (const r of results) {
  if (!byShop[r.shop]) byShop[r.shop] = { total: 0, ok: 0, fail: 0, diffs: [] };
  byShop[r.shop].total++;
  if (r.scraped) byShop[r.shop].ok++;
  else byShop[r.shop].fail++;
  if (r.diff !== null) byShop[r.shop].diffs.push(r.diff);
}

console.log("\n=== SUMMARY BY SHOP ===");
for (const [shop, s] of Object.entries(byShop)) {
  const avgDiff = s.diffs.length > 0 ? Math.round(s.diffs.reduce((a, b) => a + b, 0) / s.diffs.length) : 0;
  const exactMatch = s.diffs.filter((d) => d === 0).length;
  const close = s.diffs.filter((d) => Math.abs(d) <= 100_000).length;
  console.log(`${shop.padEnd(15)} | ${s.ok}/${s.total} success | exact: ${exactMatch} | within 100k: ${close} | avg diff: ${avgDiff.toLocaleString()}đ`);
}

console.log("\n=== TOP 10 BIGGEST MISMATCHES ===");
const big = results
  .filter((r) => r.diff !== null && Math.abs(r.diff) > 500_000)
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  .slice(0, 10);
for (const r of big) {
  console.log(`${r.shop.padEnd(13)} | ${r.product} ${r.type} ${r.storage}: sheet=${r.sheet} scraped=${r.scraped} diff=${r.diff > 0 ? "+" : ""}${(r.diff / 1000).toFixed(0)}k (${r.diffPct}%)`);
}
process.exit(0);
