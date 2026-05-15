import { chromium } from "playwright";

const url = "https://clickbuy.com.vn/iphone-12-cu.html";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: "vi-VN" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);

const html = await page.content();
console.log("html length:", html.length);
console.log("Has 5.290:", html.includes("5.290"));
console.log("Has 5.090:", html.includes("5.090"));
console.log("Has 24.990 (crossed-out):", html.includes("24.990"));

// Find all prices in valid range
const cheerio = await import("cheerio");
const $ = cheerio.load(html);

const found = new Map();
$("*").each((i, el) => {
  const $el = $(el);
  if ($el.children().length > 0) return;
  const text = $el.text().trim();
  const m = text.match(/^(\d{1,3}(?:[.,]\d{3})+)\s*[đ₫]\s*$/);
  if (m) {
    const num = parseInt(m[1].replace(/[.,]/g, ""), 10);
    if (num >= 1_000_000 && num <= 200_000_000) {
      const cls = $el.attr("class") ?? "";
      const key = `${num}|${cls.slice(0, 60)}`;
      if (!found.has(key)) found.set(key, { num, cls, text });
    }
  }
});

const sorted = Array.from(found.values()).sort((a, b) => a.num - b.num);
console.log(`\nFound ${sorted.length} unique prices:`);
for (const p of sorted.slice(0, 12)) {
  console.log(`  ${p.num.toLocaleString()}đ — class="${p.cls}"`);
}

await browser.close();
