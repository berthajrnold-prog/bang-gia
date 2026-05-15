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
await page.waitForTimeout(2500);

// Get visible main price
const mainPrice = await page.locator(".product-price .text-price").first().textContent();
const allPrices = await page.locator(".text-price").allTextContents();
console.log("Main .product-price .text-price:", mainPrice?.trim());
console.log("All .text-price elements:", allPrices.map(p => p.trim()).slice(0, 10));

// Get loai hang selected (95%/98%/99%/99+%)
const loaiButtons = await page.locator("button, [role='button']").all();
for (const b of loaiButtons.slice(0, 30)) {
  const txt = (await b.textContent())?.trim() ?? "";
  const cls = await b.getAttribute("class") ?? "";
  if (/^(95|98|99|99\+)%$/.test(txt)) {
    const isActive = cls.includes("active") || cls.includes("bg-green") || cls.includes("border-green") || cls.includes("selected");
    console.log(`Loại button: ${txt} active=${isActive} class="${cls.slice(0, 80)}"`);
  }
}

await browser.close();
process.exit(0);
