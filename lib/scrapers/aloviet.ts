import { formatVNPrice } from "./common";

// Alo Việt (alovietstore.com, WooCommerce): the visible price is filled by JS, but
// every colour swatch carries its price in the HTML:
//   <span class="swatch ..." data-price="14490000" data-name="Đỏ">
// Take the lowest swatch price (user rule: cheapest variant).
export async function scrapeAloViet(url: string, _storage?: string): Promise<string | null> {
  void _storage;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const prices = [...html.matchAll(/<span[^>]*class="[^"]*\bswatch\b[^"]*"[^>]*data-price="(\d{6,})"/g)]
    .map((m) => Number(m[1]));
  if (prices.length === 0) return null;
  return formatVNPrice(String(Math.min(...prices)));
}
