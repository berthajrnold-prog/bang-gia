import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/124.0",
  locale: "vi-VN",
  timezoneId: "Asia/Ho_Chi_Minh",
});

await ctx.addCookies([
  { name: "khu_vuc", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
  { name: "region", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
]);

const page = await ctx.newPage();
console.log("loading...");
await page.goto("https://didongxanh.com.vn/iphone-17-256gb-chinh-hang", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});

await page.waitForSelector(".product-price", { timeout: 10000 });
await page.waitForTimeout(2000); // wait for any region-based price update

const html = await page.content();
console.log("HTML length:", html.length);

// Search for various prices
console.log("Has 23.800:", html.includes("23.800"));
console.log("Has 25.300:", html.includes("25.300"));
console.log("Has Đà Nẵng promo:", html.includes("GIẢM SỐC"));

// Get the main price element
const priceEl = await page.locator(".product-price").first().textContent();
console.log("Main price element text:", priceEl?.trim());

await browser.close();
