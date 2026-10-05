import { readFile, writeFile } from "fs/promises";
import path from "path";

export const CACHE_FILE = path.join(process.cwd(), ".scrape-cache.json");

export interface CachedRow {
  product: string; type: string; storage: string; shop: string;
  price: string | null; link: string | null; category: string; priceChange: string;
  scrapeError: string | null;
}

export interface Cache {
  rows: CachedRow[];
  timestamp: string | null;
  count?: number;
}

export const rowKey = (r: { category: string; product: string; type: string; storage: string; shop: string }) =>
  `${r.category}|${r.product}|${r.type}|${r.storage}|${r.shop}`;

export async function readCache(): Promise<Cache> {
  try {
    return JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    return { rows: [], timestamp: null };
  }
}

export async function writeCache(cache: Cache): Promise<void> {
  await writeFile(CACHE_FILE, JSON.stringify(cache), "utf8");
}
