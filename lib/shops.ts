// Sections of the source sheet. Keys = section title in row 1 (lowercased),
// in the order the UI tabs are shown. Shops found in the sheet but missing here
// are appended at the end, so new sheet columns still show.
export const CATEGORIES = ["Chính hãng", "iPhone", "Android"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SHOP_ORDER: Record<Category, string[]> = {
  "Chính hãng": ["Asmart", "Mobile City", "Click Buy", "Shopdunk", "TGDĐ", "FPT", "Viettel", "Chợ lớn"],
  iPhone: ["Asmart", "Di Động Xanh", "Click Buy", "Chung Mobile"],
  Android: ["Asmart", "Mobile City", "Click Buy", "Alo Việt"],
};

// Shops that block the VPS datacenter IP (Cloudflare / 403 / timeouts). They are
// scraped from a home connection by scripts/local-agent.mjs and pushed via
// /api/merge; the VPS scrape skips them and keeps the last pushed values.
export const LOCAL_SCRAPE_SHOPS = ["FPT", "TGDĐ", "Viettel"];

export function categoryFromTitle(title: string): Category | null {
  const t = title.trim().toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === t) ?? null;
}

export function orderShops(category: Category, present: Iterable<string>): string[] {
  const known = SHOP_ORDER[category];
  const extra = [...new Set(present)].filter((s) => !known.includes(s));
  return [...known, ...extra];
}
