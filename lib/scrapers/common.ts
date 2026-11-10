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
function offerPrice(offers: unknown): string | null {
  if (!offers) return null;
  for (const offer of (Array.isArray(offers) ? offers : [offers]) as Array<Record<string, unknown>>) {
    const price = offer?.price ?? offer?.lowPrice;
    if (price) {
      const n = String(price).replace(/[^0-9]/g, "");
      if (n.length >= 6) return n;
    }
  }
  return null;
}

// `pageUrl`: when the page is a ProductGroup (TGDĐ: one entry per colour, each with its
// own ?code= url), prefer the variant whose url matches the sheet link; else the lowest.
function extractFromJsonLd(html: string, pageUrl?: string): string | null {
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
          const price = offerPrice(obj.offers);
          if (price) return price;
        }
        if (type === "ProductGroup" && Array.isArray(obj.hasVariant)) {
          const variants = obj.hasVariant as Array<Record<string, unknown>>;
          const exact = pageUrl && variants.find((v) => typeof v.url === "string" && v.url === pageUrl);
          if (exact) {
            const price = offerPrice(exact.offers);
            if (price) return price;
          }
          const prices = variants.map((v) => offerPrice(v.offers)).filter((p): p is string => !!p);
          if (prices.length) return String(Math.min(...prices.map(Number)));
        }
      }
    } catch {}
  }
  return null;
}

// Plain fetch with Node's own default User-Agent + JSON-LD price. No browser
// impersonation: FPT/TGDĐ/Viettel allow product pages in robots.txt but 403
// requests that claim to be Chrome (and headless Chromium).
export async function scrapeJsonLdViaHttp(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const price = extractFromJsonLd(await res.text(), url);
  return price ? formatVNPrice(price) : null;
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
