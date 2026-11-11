import * as cheerio from "cheerio";
import { formatVNPrice, parseVNPrice, scrapeJsonLdViaHttp, scrapeWithSelectors } from "./common";

// FPT, TGDĐ, Viettel, Chợ Lớn: each sheet link points to the exact variant (?sku= /
// ?code= / own URL) and the page's JSON-LD Product.offers.price is that variant's price.
//
// FPT, TGDĐ and Viettel reject spoofed-browser requests (and headless Chromium) but
// serve product pages to a plain fetch with Node's default User-Agent. They also block
// the VPS datacenter IP, so they run from the home machine (LOCAL_SCRAPE_SHOPS).

export async function scrapeFpt(url: string): Promise<string | null> {
  return scrapeJsonLdViaHttp(url);
}

export async function scrapeTgdd(url: string): Promise<string | null> {
  return scrapeJsonLdViaHttp(url);
}

export async function scrapeViettel(url: string): Promise<string | null> {
  return scrapeJsonLdViaHttp(url);
}

export async function scrapeChoLon(url: string): Promise<string | null> {
  return scrapeWithSelectors(url, [".product-detail .product-price-new"], { extraWait: 1500 });
}

// Di Động Việt: one URL per storage, JSON-LD Product with Offer.price or
// AggregateOffer.lowPrice (= cheapest colour). Plain fetch works.
export async function scrapeDidongviet(url: string): Promise<string | null> {
  return scrapeJsonLdViaHttp(url);
}

// Shopdunk (Apple only): one URL per storage (shopdunk.com/dien-thoai-iphone-18-pro-256gb;
// the "tis-…" pages are trade-in valuations, not sale prices). Price is in
// <meta itemprop="price" content="38990000.00"> and .product-price. Plain fetch works.
export async function scrapeShopdunk(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const meta = ($("meta[itemprop='price']").attr("content") ?? "").replace(/\.\d+$/, "").replace(/\D/g, "");
  if (/^\d{6,10}$/.test(meta)) return formatVNPrice(meta);
  const text = $(".product-price").first().text().trim();
  const parsed = parseVNPrice(text);
  return parsed ? formatVNPrice(parsed) : null;
}
