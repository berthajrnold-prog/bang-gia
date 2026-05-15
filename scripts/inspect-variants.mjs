import { chromium } from "playwright";
import * as cheerio from "cheerio";

const cases = [
  { name: "Click Buy IP17", url: "https://clickbuy.com.vn/iphone-17.html" },
  { name: "Mobile City Redmi 15", url: "https://mobilecity.vn/dien-thoai/xiaomi-redmi-note-15-chinh-hang.html" },
];

const browser = await chromium.launch({ headless: true });

for (const c of cases) {
  console.log(`\n========== ${c.name} ==========`);
  const ctx = await browser.newContext({ locale: "vi-VN" });
  if (c.url.includes("clickbuy")) {
    await ctx.addCookies([{ name: "city", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" }]);
  }
  const page = await ctx.newPage();
  await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const html = await page.content();
  const $ = cheerio.load(html);

  // Find all elements containing both a storage AND a price within
  console.log("\nElements with BOTH storage label + price (variant cards):");
  const found = new Set();
  $("*").each((_, el) => {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (text.length > 200) return;
    // Match patterns like "128GB ... 6.190.000đ" or "1TB ... 49.000.000đ"
    const m = text.match(/(64|128|256|512)\s*GB|1\s*TB/i);
    const p = text.match(/(\d{1,3}(?:[.,]\d{3})+)\s*[đ₫]/);
    if (m && p && text.length < 100) {
      const cls = $el.attr("class") ?? "";
      const tag = el.tagName ?? el.name;
      const key = `${tag}|${cls}|${text.slice(0, 40)}`;
      if (!found.has(key) && cls.length > 0) {
        found.add(key);
        const price = parseInt(p[1].replace(/[.,]/g, ""), 10);
        if (price >= 3_000_000) {
          console.log(`  <${tag}> "${text.slice(0, 60)}" class="${cls.slice(0, 50)}"`);
        }
      }
    }
  });

  // Also check for data-attributes that indicate variants
  console.log("\nElements with data-* attrs related to variant/price:");
  $("*").each((_, el) => {
    const $el = $(el);
    const attribs = el.attribs ?? {};
    for (const [k, v] of Object.entries(attribs)) {
      if (k.startsWith("data-") && /price|variant|storage|capacity|version/i.test(k)) {
        const text = $el.text().slice(0, 40).trim();
        console.log(`  ${k}="${v.slice(0, 40)}" text="${text}"`);
      }
    }
  });

  await ctx.close();
}

await browser.close();
process.exit(0);
