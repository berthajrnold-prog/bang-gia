import { scrapeWithSelectors } from "./common";

const SELECTORS = [
  ".product-price .price",
  ".price-box .price",
  ".product__price",
  ".price-final",
  "[itemprop='price']",
  ".price",
];

export async function scrapeAloViet(url: string, _storage?: string): Promise<string | null> {
  void _storage;
  return scrapeWithSelectors(url, SELECTORS);
}
