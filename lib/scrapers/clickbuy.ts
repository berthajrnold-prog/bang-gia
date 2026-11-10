import * as cheerio from "cheerio";
import { formatVNPrice } from "./common";

// ClickBuy (redesign 11/2026, "cb-" classes, behind Cloudflare: curl's TLS is rejected,
// Node's fetch and real browsers are fine). Everything is in the static HTML:
//   h1                                      → page's own version ("… (5G) 12GB 256GB …")
//   li[data-v][data-price]                  → price per variant (data-v) per warranty (data-w)
//   [data-cb-variants] li[data-id][data-aN] → variant → attribute ids (colour, storage, …)
//   .cb-picktile[data-cb-attr]              → attribute tiles ("256GB", "Máy 95%", "Black")
//   .cb-picktile[href]                      → other versions = other pages, each showing that
//                                             version's lowest price
// Rule (user): cheapest variant of the requested storage = cheapest condition/colour, free
// warranty.

const DA_NANG_COOKIE = "city=da-nang; khu_vuc=da-nang; branch=da-nang; region=da-nang";

function priceIn(text: string | undefined): number | null {
  const m = (text ?? "").match(/(\d{1,3}(?:[.,]\d{3}){2,})/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return n >= 1_000_000 && n <= 200_000_000 ? n : null;
}

function netOf(text: string): "4G" | "5G" | null {
  return /\b5G\b/i.test(text) ? "5G" : /\b4G\b/i.test(text) ? "4G" : null;
}

function min(nums: Array<number | null | undefined>): number | null {
  const xs = nums.filter((n): n is number => !!n);
  return xs.length ? Math.min(...xs) : null;
}

export async function scrapeClickBuy(url: string, storage?: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { Cookie: DA_NANG_COOKIE, "Accept-Language": "vi-VN,vi;q=0.9" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const pagePath = new URL(url).pathname;

  // Variant id → lowest price (free warranty).
  const variantPrice = new Map<string, number>();
  $("li[data-v][data-price]").each((_, el) => {
    const id = $(el).attr("data-v")!;
    const p = priceIn($(el).attr("data-price"));
    if (p && (!variantPrice.has(id) || p < variantPrice.get(id)!)) variantPrice.set(id, p);
  });
  const variantAttrs = $("[data-cb-variants] li[data-id]")
    .toArray()
    .map((el) => ({
      id: $(el).attr("data-id")!,
      attrs: ["data-a1", "data-a2", "data-a3", "data-a4"].map((a) => $(el).attr(a)).filter((v) => v && v !== "0"),
    }));

  const tiles = $(".cb-picktile")
    .toArray()
    .map((el) => {
      const href = $(el).attr("href");
      let self = false;
      try { self = !!href && new URL(href, url).pathname === pagePath; } catch {}
      return { text: $(el).text().replace(/\s+/g, " ").trim(), href, self, attr: $(el).attr("data-cb-attr"), price: priceIn($(el).text()) };
    });

  // Cheapest variant on this page.
  const pageMin = () =>
    min([...variantPrice.values()]) ??
    min(tiles.filter((t) => (!t.href || t.self) && t.price).map((t) => t.price)) ??
    priceIn($("[data-cb-price]").first().text());

  if (storage) {
    const isTB = /TB/i.test(storage);
    const slash = storage.match(/(\d+)\s*\/\s*(\d+)/);
    const num = slash?.[2] ?? storage.match(/\d+/)?.[0];
    if (num) {
      const unit = isTB ? "TB" : "GB";
      const storageRe = new RegExp(`(^|\\D)${num}\\s*${unit}\\b`, "i");
      // "8/128" → RAM too, when the text states it ("8GB 128GB", "[8.128GB]", "8/128GB")
      const ramRe = slash ? new RegExp(`(^|\\D)${slash[1]}\\s*(GB)?\\s*[./ ]\\s*${num}\\s*${unit}`, "i") : null;
      const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
      const wantedNet = netOf(storage) ?? netOf(h1);

      const matches = (list: typeof tiles) => {
        let m = list.filter((t) => storageRe.test(t.text));
        if (wantedNet) m = m.filter((t) => (netOf(t.text) ?? wantedNet) === wantedNet);
        if (ramRe && m.some((t) => ramRe.test(t.text))) m = m.filter((t) => ramRe.test(t.text));
        return m;
      };

      // 1. Storage is selectable on this page → cheapest variant carrying that attribute.
      const attrTiles = matches(tiles.filter((t) => t.attr));
      if (attrTiles.length && variantAttrs.length) {
        const ids = new Set(attrTiles.map((t) => t.attr!));
        const p = min(variantAttrs.filter((v) => v.attrs.some((a) => ids.has(a!))).map((v) => variantPrice.get(v.id)));
        if (p) return formatVNPrice(String(p));
      }
      // 2. This page is the requested version (per h1) → cheapest variant here.
      const h1Storage = storageRe.test(h1) && (!ramRe || !/\d+\s*GB\s*\d+\s*GB/i.test(h1) || ramRe.test(h1));
      const h1Net = netOf(h1);
      if (h1Storage && (!wantedNet || !h1Net || h1Net === wantedNet)) {
        const p = pageMin();
        if (p) return formatVNPrice(String(p));
      }
      // 3. Another version (link tile) → that version's lowest price.
      const p = min(matches(tiles.filter((t) => t.href && t.price)).map((t) => t.price));
      if (p) return formatVNPrice(String(p));
    }
  }

  const p = pageMin();
  return p ? formatVNPrice(String(p)) : null;
}
