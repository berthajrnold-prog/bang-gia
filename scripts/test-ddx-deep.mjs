import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: "vi-VN" });
await ctx.addCookies([
  { name: "khu_vuc", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
  { name: "region", value: "da-nang", domain: ".didongxanh.com.vn", path: "/" },
]);
const page = await ctx.newPage();
await page.goto("https://didongxanh.com.vn/iphone-16-pro-max-1tb-cu-dep-99-zin-nguyen-ban", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForTimeout(3000);

// Check what is selected for Loai hang (which condition)
const loaiHangSection = await page.evaluate(() => {
  const findText = (re) => Array.from(document.querySelectorAll("button, span, div"))
    .filter(el => re.test(el.textContent?.trim() ?? "") && el.children.length === 0);
  const conditionBtns = findText(/^(95|98|99|99\+)%$/);
  return conditionBtns.map(b => ({
    text: b.textContent?.trim(),
    classes: b.className,
    parent: b.parentElement?.className?.slice(0, 80),
  }));
});

console.log("Loại hàng buttons:", JSON.stringify(loaiHangSection, null, 2));

// Try to click 99%
console.log("\nTrying to click 99%...");
try {
  const btn = page.getByText(/^99%$/).first();
  await btn.click({ timeout: 3000 });
  await page.waitForTimeout(2000);
  const newPrice = await page.locator(".product-price .text-price").first().textContent();
  console.log("Price after clicking 99%:", newPrice?.trim());
} catch (e) {
  console.log("Click failed:", String(e).slice(0, 100));
}

await browser.close();
process.exit(0);
