import * as cheerio from "cheerio";
import { fetchHtmlWithBrowser, type FetchOptions } from "./browser";

// All scrapers now use Playwright (browser-rendered HTML) for consistency
export async function fetchHtml(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  return fetchHtmlWithBrowser(url, options);
}

export function formatVNPrice(numeric: string): string {
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseVNPrice(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[đ₫VNDvnd\s,.]/g, "");
  if (/^\d{6,10}$/.test(cleaned)) return cleaned;

  // Handle dot-separated: "23.800.000"
  const dotted = raw.replace(/[đ₫VNDvnd\s]/g, "");
  const numeric = dotted.replace(/\./g, "").replace(/,/g, "");
  if (/^\d{6,10}$/.test(numeric)) return numeric;
  return null;
}

// JSON-LD: most reliable — many VN shops embed Product structured data
function extractFromJsonLd(html: string): string | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      // Flatten: handle root-level array, single object, or @graph wrapper
      const items: unknown[] = [];
      const collect = (d: unknown) => {
        if (!d) return;
        if (Array.isArray(d)) { d.forEach(collect); return; }
        if (typeof d !== "object") return;
        const obj = d as Record<string, unknown>;
        items.push(obj);
        if (obj["@graph"]) collect(obj["@graph"]);
      };
      collect(data);

      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];
        if (type === "Product" || type === "ItemPage") {
          const offers = obj.offers;
          if (!offers) continue;
          const offerList = Array.isArray(offers) ? offers : [offers];
          for (const offer of offerList as Array<Record<string, unknown>>) {
            const price = offer?.price ?? offer?.lowPrice;
            if (price) {
              const n = String(price).replace(/[^0-9]/g, "");
              if (n.length >= 6) return n;
            }
          }
        }
      }
    } catch {}
  }
  return null;
}

// Meta tags: og:price, itemprop price
function extractFromMeta(html: string): string | null {
  const patterns = [
    /<meta[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["']/i,
    /<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']product:price:amount["']/i,
    /<meta[^>]*name=["']price["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    if (match) {
      const n = match[1].replace(/[^0-9]/g, "");
      if (n.length >= 6) return n;
    }
  }
  return null;
}

// CSS selector scan
export function trySelectors($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) return text;
  }
  return null;
}

export interface ScrapeOptions {
  // Skip JSON-LD/meta tags (use when shop has MSRP in structured data, not actual sale price)
  selectorsOnly?: boolean;
  // When multiple price selectors match, pick lowest (= the sale price)
  preferLowest?: boolean;
  // Min valid price (filter out accessories). Default 1,000,000.
  minPrice?: number;
  // Max valid price. Default 200,000,000.
  maxPrice?: number;
  // Wait for selector before extracting (ensures JS-rendered prices are loaded)
  waitForSelector?: string;
  // Cookies to set (e.g., region preference for shop-specific pricing)
  cookies?: Array<{ name: string; value: string; domain: string; path?: string }>;
  // Extra wait after page load (ms)
  extraWait?: number;
}

export async function scrapeWithSelectors(
  url: string,
  selectors: string[],
  options: ScrapeOptions = {}
): Promise<string | null> {
  const html = await fetchHtml(url, {
    waitForSelector: options.waitForSelector,
    cookies: options.cookies,
    extraWait: options.extraWait,
  });

  if (!options.selectorsOnly) {
    const fromJsonLd = extractFromJsonLd(html);
    if (fromJsonLd) return formatVNPrice(fromJsonLd);

    const fromMeta = extractFromMeta(html);
    if (fromMeta) return formatVNPrice(fromMeta);
  }

  const $ = cheerio.load(html);

  if (options.preferLowest) {
    const min = options.minPrice ?? 1_000_000;
    const max = options.maxPrice ?? 200_000_000;
    // Collect all matching prices, return lowest (= sale price, not MSRP)
    const candidates: number[] = [];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        const parsed = parseVNPrice(text);
        if (parsed) {
          const n = parseInt(parsed, 10);
          if (n >= min && n <= max) candidates.push(n);
        }
      });
    }
    if (candidates.length > 0) {
      const lowest = Math.min(...candidates);
      return formatVNPrice(String(lowest));
    }
  } else {
    const raw = trySelectors($, selectors);
    if (raw) {
      const price = parseVNPrice(raw);
      if (price) return formatVNPrice(price);
    }
  }

  return null;
}
