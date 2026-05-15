import { NextResponse } from "next/server";
import { readPriceSheet, getLastPrices, writeHistorySheet } from "@/lib/sheets";
import { scrapePrice } from "@/lib/scrapers";
import { closeBrowser } from "@/lib/scrapers/browser";
import { writeFile } from "fs/promises";
import path from "path";

export const maxDuration = 600;
const CACHE_FILE = path.join(process.cwd(), ".scrape-cache.json");

export async function POST() {
  try {
    const [entries, lastPrices] = await Promise.all([
      readPriceSheet(),
      getLastPrices(),
    ]);

    const timestamp = new Date().toISOString();

    // Concurrency: 3 = balanced for 2GB VPS (3 Playwright pages × ~250MB ≈ 750MB)
    const BATCH_SIZE = 3;
    const scrapedData: Array<{
      product: string; type: string; storage: string; shop: string;
      price: string | null; link: string | null; category: string; priceChange: string;
      scrapeError: string | null;
    }> = [];

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (entry) => {
          let scrapedPrice: string | null = null;
          let scrapeError: string | null = null;

          // Asmart: always use sheet price (no website to scrape)
          if (entry.shop === "Asmart") {
            scrapedPrice = entry.price;
          } else if (entry.link) {
            try {
              scrapedPrice = await scrapePrice(entry.link, { storage: entry.storage });
              if (!scrapedPrice) scrapeError = "Không tìm thấy giá trong page";
            } catch (e) {
              scrapeError = String(e).slice(0, 100);
            }
          }

          const key = `${entry.product}|${entry.type}|${entry.storage}|${entry.shop}`;
          const lastPrice = lastPrices.get(key);
          let priceChange = "";
          if (scrapedPrice && lastPrice) {
            const cur = parseInt(scrapedPrice.replace(/\./g, ""), 10);
            const last = parseInt(lastPrice.replace(/\./g, ""), 10);
            priceChange = cur > last ? "up" : cur < last ? "down" : "same";
          }

          return {
            product: entry.product,
            type: entry.type,
            storage: entry.storage,
            shop: entry.shop,
            price: scrapedPrice,
            link: entry.link,
            category: entry.category,
            priceChange,
            scrapeError,
          };
        })
      );
      scrapedData.push(...results);
    }

    await writeHistorySheet(scrapedData, timestamp);

    const count = scrapedData.filter((d) => d.price).length;

    // Cache to file so /api/latest can serve it (for shared viewers without scrape access)
    await writeFile(
      CACHE_FILE,
      JSON.stringify({ rows: scrapedData, timestamp, count }),
      "utf8"
    ).catch(() => {});

    await closeBrowser().catch(() => {});

    return NextResponse.json({ ok: true, timestamp, count, data: scrapedData });
  } catch (err) {
    console.error(err);
    await closeBrowser().catch(() => {});
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
