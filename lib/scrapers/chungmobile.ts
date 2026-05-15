import * as cheerio from "cheerio";
import { fetchHtml, formatVNPrice, scrapeWithSelectors } from "./common";

interface Variation {
  attributes: Record<string, string>;
  display_price: number;
}

// Normalize "128GB" / "128 GB" / "128gb" → "128gb"
function normalizeStorage(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

function extractVariations(html: string): Variation[] | null {
  const $ = cheerio.load(html);
  const form = $("form.variations_form, .variations_form").first();
  const raw = form.attr("data-product_variations");
  if (!raw) return null;
  try {
    const decoded = raw
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

const SELECTORS = [
  ".woocommerce-Price-amount.amount",
  ".price .amount",
  ".price",
];

export async function scrapeChungMobile(
  url: string,
  storage?: string
): Promise<string | null> {
  // Try variation-aware extraction first (most product pages have multiple storage variants)
  if (storage) {
    try {
      const html = await fetchHtml(url);
      const variations = extractVariations(html);
      if (variations && variations.length > 0) {
        const wanted = normalizeStorage(storage);
        // Find variations matching the requested storage (any color)
        const matching = variations.filter((v) => {
          const storageAttr = v.attributes?.attribute_pa_bo_nho ?? v.attributes?.attribute_pa_dung_luong ?? "";
          return normalizeStorage(storageAttr) === wanted;
        });
        if (matching.length > 0) {
          // Return the lowest price among matching variants (sale price)
          const prices = matching.map((v) => v.display_price).filter((p) => p > 0);
          if (prices.length > 0) {
            const min = Math.min(...prices);
            return formatVNPrice(String(min));
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback: standard scraper (uses JSON-LD lowPrice)
  return scrapeWithSelectors(url, SELECTORS);
}
