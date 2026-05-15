import { scrapeClickBuy } from "./clickbuy";
import { scrapeDidongxanh } from "./didongxanh";
import { scrapeAsmart } from "./asmart";
import { scrapeChungMobile } from "./chungmobile";
import { scrapeMobileCity } from "./mobilecity";
import { scrapeAloViet } from "./aloviet";

export interface ScrapeContext {
  storage?: string;
}

type ScraperFn = (url: string, storage?: string) => Promise<string | null>;

const DOMAIN_RULES: Array<{ match: string; scraper: ScraperFn; name: string }> = [
  { match: "clickbuy", scraper: scrapeClickBuy, name: "ClickBuy" },
  { match: "didongxanh", scraper: scrapeDidongxanh, name: "Di Động Xanh" },
  { match: "asmart", scraper: scrapeAsmart, name: "Asmart" },
  { match: "chungmobile", scraper: scrapeChungMobile, name: "Chung Mobile" },
  { match: "mobilecity", scraper: scrapeMobileCity, name: "Mobile City" },
  { match: "aloviet", scraper: scrapeAloViet, name: "Alo Việt" },
];

export async function scrapePrice(
  url: string,
  context: ScrapeContext = {}
): Promise<string | null> {
  try {
    const { hostname } = new URL(url);
    const rule = DOMAIN_RULES.find((r) => hostname.includes(r.match));
    if (!rule) {
      console.warn(`[scraper] No scraper for domain: ${hostname}`);
      return null;
    }
    const price = await rule.scraper(url, context.storage);
    if (!price) {
      console.warn(`[scraper] ${rule.name} returned null for ${url}`);
    }
    return price;
  } catch (err) {
    console.error(`[scraper] Error scraping ${url}:`, err);
    return null;
  }
}
