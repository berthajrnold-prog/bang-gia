import { NextRequest, NextResponse } from "next/server";
import { readCache, writeCache, rowKey, type CachedRow } from "@/lib/cache";

// POST: merge rows scraped on a home machine (shops that block the VPS IP) into the
// shared cache. Auth: x-merge-key must equal HISTORY_SHEET_ID (present in both .env.local).
export async function POST(req: NextRequest) {
  if (!process.env.HISTORY_SHEET_ID || req.headers.get("x-merge-key") !== process.env.HISTORY_SHEET_ID) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { rows?: CachedRow[] };
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, error: "missing rows" }, { status: 400 });
  }

  const cache = await readCache();
  const index = new Map(cache.rows.map((r, i) => [rowKey(r), i]));
  let updated = 0;
  let added = 0;
  for (const row of body.rows) {
    const i = index.get(rowKey(row));
    const old = i === undefined ? undefined : cache.rows[i];
    let priceChange = "";
    if (row.price && old?.price) {
      const cur = parseInt(row.price.replace(/\./g, ""), 10);
      const last = parseInt(old.price.replace(/\./g, ""), 10);
      priceChange = cur > last ? "up" : cur < last ? "down" : "same";
    }
    const merged: CachedRow = { ...row, priceChange };
    if (i === undefined) {
      cache.rows.push(merged);
      added++;
    } else {
      cache.rows[i] = merged;
      updated++;
    }
  }
  cache.count = cache.rows.filter((r) => r.price).length;
  await writeCache(cache);
  return NextResponse.json({ ok: true, updated, added });
}
