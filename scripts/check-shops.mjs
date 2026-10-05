// Diagnose FPT / TGDĐ access from this server: plain HTTP vs headless Chromium
import axios from "axios";
import { chromium } from "playwright";

const urls = [
  "https://fptshop.com.vn/dien-thoai/iphone-18-pro?sku=00930913",
  "https://www.thegioididong.com/dtdd/iphone-18-pro-512gb",
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const ldPrice = (html) => String(html).match(/"price"\s*:\s*"?(\d{6,})/)?.[1] ?? "-";
const title = (html) => String(html).match(/<title>([^<]{0,60})/)?.[1] ?? "-";

for (const url of urls) {
  try {
    const r = await axios.get(url, { timeout: 20000, responseType: "text", validateStatus: () => true, headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9" } });
    console.log(`HTTP  ${r.status} price=${ldPrice(r.data)} title=${title(r.data)} | ${url}`);
  } catch (e) {
    console.log(`HTTP  ERR ${e.message} | ${url}`);
  }
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"] });
for (const url of urls) {
  const ctx = await browser.newContext({ userAgent: UA, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    const html = await page.content();
    console.log(`CHROM ${resp?.status()} price=${ldPrice(html)} title=${title(html)} final=${page.url().slice(0, 70)}`);
  } catch (e) {
    console.log(`CHROM ERR ${String(e).slice(0, 100)} | ${url}`);
  }
  await ctx.close();
}
await browser.close();
