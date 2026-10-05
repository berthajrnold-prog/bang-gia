// Display order of shop columns (matches the source sheet). Shops found in the
// sheet but missing here are appended at the end, so new sheet columns still show.
export const SHOP_ORDER: Record<"iPhone" | "Android", string[]> = {
  iPhone: ["Asmart", "Di Động Xanh", "Click Buy", "Chung Mobile", "FPT", "TGDĐ", "Viettel"],
  Android: ["Asmart", "Mobile City", "Click Buy", "Alo Việt", "Viettel", "Chợ lớn"],
};

// Shops that block the VPS datacenter IP (Cloudflare / timeouts). They are scraped
// from a home connection with scripts/scrape-local.mjs and pushed via /api/merge;
// the VPS scrape skips them and keeps the last pushed values.
export const LOCAL_SCRAPE_SHOPS = ["FPT", "TGDĐ"];

export function orderShops(category: "iPhone" | "Android", present: Iterable<string>): string[] {
  const known = SHOP_ORDER[category];
  const extra = [...new Set(present)].filter((s) => !known.includes(s));
  return [...known, ...extra];
}
