import { chromium } from "playwright";
import * as cheerio from "cheerio";

const links = [
  { name: "Click Buy IP17", url: "https://clickbuy.com.vn/iphone-17.html", cookies: [{ name: "city", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" }] },
  { name: "Mobile City Redmi 15", url: "https://mobilecity.vn/dien-thoai/xiaomi-redmi-note-15-chinh-hang.html", cookies: [] },
  { name: "Di Dong Xanh IP16PM 1TB", url: "https://didongxanh.com.vn/iphone-16-pro-max-1tb-cu-dep-99-zin-nguyen-ban", cookies: [{ name: "khu_vuc", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" }] },
];

const browser = await chromium.launch({ headless: true });

for (const link of links) {
  console.log(`\n========== ${link.name} ==========`);
  const ctx = await browser.newContext({ locale: "vi-VN" });
  if (link.cookies.length > 0) await ctx.addCookies(link.cookies);
  const page = await ctx.newPage();
  await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);

  const html = await page.content();
  const $ = cheerio.load(html);

  // Find ALL clean prices and group by class
  const priceMap = new Map();
  $("*").each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return;
    const text = $el.text().trim();
    const m = text.match(/^(\d{1,3}(?:[.,]\d{3})+)\s*[đ₫]\s*$/);
    if (m) {
      const num = parseInt(m[1].replace(/[.,]/g, ""), 10);
      if (num >= 3_000_000 && num <= 200_000_000) {
        const cls = $el.attr("class") ?? "";
        const parent = $el.parent();
        const parentCls = parent.attr("class") ?? "";
        const key = `${num}|${cls.slice(0, 60)}`;
        if (!priceMap.has(key)) {
          priceMap.set(key, { num, cls, parentCls: parentCls.slice(0, 80), text });
        }
      }
    }
  });

  const sorted = Array.from(priceMap.values()).sort((a, b) => a.num - b.num);
  console.log(`Found ${sorted.length} unique product prices:`);
  for (const p of sorted) {
    console.log(`  ${p.num.toLocaleString()}đ — class="${p.cls}" parent="${p.parentCls}"`);
  }

  // Find storage options nearby
  console.log("\nStorage-like elements:");
  $("*").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (/^(64|128|256|512|1024)\s*GB$|^1\s*TB$/i.test(text) && $el.children().length === 0) {
      const cls = $el.attr("class") ?? "";
      console.log(`  "${text}" class="${cls.slice(0, 60)}"`);
    }
  });

  await ctx.close();
}

await browser.close();
process.exit(0);
