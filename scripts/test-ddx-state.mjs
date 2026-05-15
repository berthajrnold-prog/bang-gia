import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false }); // SHOW browser
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
await page.waitForTimeout(4000);

// Find condition buttons with surrounding HTML
const result = await page.evaluate(() => {
  // Search for "Loại hàng" label first
  const labels = Array.from(document.querySelectorAll("*"))
    .filter(el => el.textContent?.trim() === "Loại hàng" && el.children.length === 0);
  if (labels.length === 0) return { error: "Loại hàng label not found" };

  const label = labels[0];
  // Find sibling/parent that contains condition buttons
  let container = label.parentElement;
  for (let i = 0; i < 5; i++) {
    if (container?.querySelectorAll("button, [role='button']").length >= 4) break;
    container = container?.parentElement;
  }
  if (!container) return { error: "container not found" };

  return {
    containerHtml: container.outerHTML.slice(0, 2000),
  };
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
process.exit(0);
