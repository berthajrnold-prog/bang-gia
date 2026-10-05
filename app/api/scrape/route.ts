import { NextResponse } from "next/server";
import { readPriceSheet, getLastPrices, writeHistorySheet } from "@/lib/sheets";
import { scrapePrice } from "@/lib/scrapers";
import { closeBrowser } from "@/lib/scrapers/browser";
import { readCache, writeCache, rowKey } from "@/lib/cache";
import { LOCAL_SCRAPE_SHOPS } from "@/lib/shops";
import { updateAgentState } from "@/lib/local-agent";

export const maxDuration = 600;

export async function POST() {
  try {
    const [entries, lastPrices, prevCache] = await Promise.all([
      readPriceSheet(),
      getLastPrices(),
      readCache(),
    ]);
    const prevRows = new Map(prevCache.rows.map((r) => [rowKey(r), r]));

    const timestamp = new Date().toISOString();
    // Ask the home-machine agent to scrape LOCAL_SCRAPE_SHOPS (it polls /api/local-request)
    await updateAgentState({ requestedAt: timestamp }).catch(() => {});

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
          } else if (LOCAL_SCRAPE_SHOPS.includes(entry.shop)) {
            // Blocked from the VPS IP: keep the last value pushed from the home machine
            scrapedPrice = prevRows.get(rowKey(entry))?.price ?? null;
            if (!scrapedPrice) scrapeError = "Chưa có giá — máy tính cào FPT/TGDĐ chưa gửi lên";
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

    // The agent usually pushes FPT/TGDĐ while this long scrape is running —
    // take local-shop rows from the latest cache rather than the start snapshot.
    const latestCache = await readCache();
    const latestRows = new Map(latestCache.rows.map((r) => [rowKey(r), r]));
    for (const d of scrapedData) {
      const fresh = LOCAL_SCRAPE_SHOPS.includes(d.shop) ? latestRows.get(rowKey(d)) : undefined;
      if (fresh?.price) Object.assign(d, { price: fresh.price, priceChange: fresh.priceChange, scrapeError: null });
    }

    await writeHistorySheet(scrapedData, timestamp);

    const count = scrapedData.filter((d) => d.price).length;

    // Cache to file so /api/latest can serve it (for shared viewers without scrape access)
    const localUpdatedAt = latestCache.localUpdatedAt ?? null;
    await writeCache({ rows: scrapedData, timestamp, count, localUpdatedAt }).catch(() => {});

    await closeBrowser().catch(() => {});

    return NextResponse.json({ ok: true, timestamp, count, localUpdatedAt, data: scrapedData });
  } catch (err) {
    console.error(err);
    await closeBrowser().catch(() => {});
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
