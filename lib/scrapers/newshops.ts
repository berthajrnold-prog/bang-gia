import { scrapeJsonLdViaHttp, scrapeWithSelectors } from "./common";

// FPT, TGDĐ, Chợ Lớn: each sheet link points to the exact variant (?sku= / ?code= /
// own URL) and the page's JSON-LD Product.offers.price is that variant's selling price.

export async function scrapeFpt(url: string): Promise<string | null> {
  return scrapeWithSelectors(url, [".text-black-opacity-100.pc\\:h4-bold"], { extraWait: 1500 });
}

export async function scrapeTgdd(url: string): Promise<string | null> {
  return scrapeWithSelectors(url, [".box-price-present"], { extraWait: 1500 });
}

export async function scrapeChoLon(url: string): Promise<string | null> {
  return scrapeWithSelectors(url, [".product-detail .product-price-new"], { extraWait: 1500 });
}

// Viettel Store blocks headless Chromium (Akamai "Access Denied"), plain HTTP works.
export async function scrapeViettel(url: string): Promise<string | null> {
  return scrapeJsonLdViaHttp(url);
}
