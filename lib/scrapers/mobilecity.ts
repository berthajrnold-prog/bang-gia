import { scrapeWithSelectors } from "./common";

const SELECTORS = [
  ".product-price .price",
  ".box-price .price",
  ".price-box .price",
  ".product__price",
  "[itemprop='price']",
  ".price",
  ".detail-price",
];

export async function scrapeMobileCity(url: string, _storage?: string): Promise<string | null> {
  void _storage;
  return scrapeWithSelectors(url, SELECTORS);
}
