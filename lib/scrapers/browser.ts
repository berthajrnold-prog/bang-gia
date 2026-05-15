import { chromium, type Browser, type BrowserContext } from "playwright";

// Singleton: keep browser alive across requests for speed.
// Process exit will clean it up.
declare global {
  // eslint-disable-next-line no-var
  var __scraperBrowser: Browser | undefined;
}

async function getBrowser(): Promise<Browser> {
  if (globalThis.__scraperBrowser && globalThis.__scraperBrowser.isConnected()) {
    return globalThis.__scraperBrowser;
  }
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  globalThis.__scraperBrowser = browser;
  return browser;
}

export interface FetchOptions {
  waitForSelector?: string;
  cookies?: Array<{ name: string; value: string; domain: string; path?: string }>;
  extraWait?: number;
}

async function tryFetch(url: string, options: FetchOptions): Promise<string> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
    },
  });

  try {
    if (options.cookies && options.cookies.length > 0) {
      await ctx.addCookies(
        options.cookies.map((c) => ({ ...c, path: c.path ?? "/" }))
      );
    }
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 8000 }).catch(() => {});
    }
    if (options.extraWait) {
      await page.waitForTimeout(options.extraWait);
    }
    return await page.content();
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function fetchHtmlWithBrowser(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  try {
    return await tryFetch(url, options);
  } catch (err) {
    const msg = String(err);
    // Retry once if browser/context was closed mid-request
    if (msg.includes("browser has been closed") || msg.includes("Target page")) {
      // Force fresh browser
      try {
        await globalThis.__scraperBrowser?.close().catch(() => {});
      } catch {}
      globalThis.__scraperBrowser = undefined;
      return await tryFetch(url, options);
    }
    throw err;
  }
}

// No-op for backward compat — browser stays alive for next request
export async function closeBrowser(): Promise<void> {
  // Intentionally not closing — browser is a process-level singleton
}
