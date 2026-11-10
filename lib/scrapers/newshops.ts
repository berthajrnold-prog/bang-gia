import { scrapeJsonLdViaHttp, scrapeWithSelectors } from "./common";

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
