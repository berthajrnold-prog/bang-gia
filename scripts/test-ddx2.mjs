import axios from "axios";
import * as cheerio from "cheerio";

const url = "https://didongxanh.com.vn/iphone-17-256gb-chinh-hang";
const res = await axios.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/124.0",
    "Accept-Language": "vi-VN,vi;q=0.9",
    Cookie: "khu_vuc=da_nang; region=da_nang",
  },
});
const html = res.data;
const $ = cheerio.load(html);

// Find ALL elements containing a VND-like price
const priceEls = [];
$("p, span, div").each((i, el) => {
  const $el = $(el);
  // Skip if has children (we want leaf nodes)
  if ($el.children().length > 0) return;
  const text = $el.text().trim();
  const m = text.match(/^(\d{1,3}(?:[.,]\d{3})+)\s*[đ₫]\s*$/);
  if (m) {
    const num = parseInt(m[1].replace(/[.,]/g, ""), 10);
    if (num >= 1_000_000 && num <= 200_000_000) {
      priceEls.push({ class: $el.attr("class") ?? "", text, num });
    }
  }
});

// Sort by price
priceEls.sort((a, b) => a.num - b.num);
console.log("Found", priceEls.length, "price elements:");
for (const p of priceEls.slice(0, 15)) {
  console.log(`  ${p.num.toLocaleString()}đ — class="${p.class.slice(0, 80)}"`);
}
