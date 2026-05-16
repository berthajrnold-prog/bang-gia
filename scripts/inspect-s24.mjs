import { chromium } from "playwright";
import * as cheerio from "cheerio";

const urls = [
  "https://clickbuy.com.vn/samsung-s24-plus-cu.html",
  "https://mobilecity.vn/dien-thoai/samsung-galaxy-s24-plus-cu-dep-nhu-moi.html",
];

const browser = await chromium.launch({ headless: true });
for (const url of urls) {
  console.log(`\n===== ${url} =====`);
  const ctx = await browser.newContext({ locale: "vi-VN" });
  if (url.includes("clickbuy")) {
    await ctx.addCookies([{ name: "city", value: "da-nang", domain: ".clickbuy.com.vn", path: "/" }]);
  }
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);
  const html = await page.content();
  const $ = cheerio.load(html);

  console.log("h1:", $("h1").first().text().trim());
  console.log("Main .js-price.price (CB):", $(".js-price.price").first().text().trim() || "(empty)");
  console.log(".related_versions__item count (CB):", $(".related_versions__item").length);
  $(".related_versions__item").each((_, el) => {
    const $el = $(el);
    console.log("  variant:", $el.text().replace(/\s+/g, " ").trim().slice(0, 100), "data-price:", $el.find("[data-price]").attr("data-price"));
  });

  console.log("MC main .product-summary-price:", $(".product-summary-price").first().text().trim() || "(empty)");
  console.log("MC data-storage_id count:", $("[data-storage_id]").length);
  $("[data-storage_id]").each((_, el) => {
    const $el = $(el);
    console.log("  storage:", $el.text().trim().slice(0, 50), "id:", $el.attr("data-storage_id"), "price:", $el.attr("data-price"));
  });

  await ctx.close();
}
await browser.close();
process.exit(0);
