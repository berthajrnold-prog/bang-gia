import axios from "axios";
import * as cheerio from "cheerio";

const urls = [
  "https://didongxanh.com.vn/iphone-17-256gb-chinh-hang",
  "https://didongxanh.com.vn/iphone-17-512gb-chinh-hang",
];

for (const url of urls) {
  console.log("\n=====", url, "=====");
  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/124.0" },
  });
  const html = res.data;
  const $ = cheerio.load(html);
  console.log("status:", res.status, "length:", html.length);

  // Check JSON-LD
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let ldIdx = 0;
  while ((m = ldRe.exec(html)) !== null) {
    ldIdx++;
    try {
      const data = JSON.parse(m[1]);
      const txt = JSON.stringify(data);
      if (/price|offer/i.test(txt)) {
        console.log(`JSON-LD #${ldIdx} (truncated):`, txt.slice(0, 800));
      }
    } catch {}
  }

  // Check meta
  const metaPrice = html.match(/<meta[^>]*(?:itemprop|property)=["'](?:price|product:price:amount)["'][^>]*content=["']([^"']+)["']/i);
  console.log("meta price:", metaPrice?.[1] ?? "(none)");

  // Try common selectors and dump matches
  const selectors = [
    ".pd-price-new",
    ".price-new",
    ".price-sale",
    ".special-price",
    ".pd-price",
    ".product-price",
    ".price",
    "[class*='price']",
  ];
  for (const sel of selectors) {
    const matches = $(sel);
    if (matches.length === 0) continue;
    console.log(`[${sel}] count=${matches.length}`);
    matches.slice(0, 4).each((i, el) => {
      const cls = $(el).attr("class") ?? "";
      const txt = $(el).text().trim().slice(0, 100).replace(/\s+/g, " ");
      console.log(`  ${i} class="${cls}" text="${txt}"`);
    });
  }
}
