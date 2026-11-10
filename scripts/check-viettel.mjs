// Checks whether Viettel Store serves product HTML to this machine.
// Uses Node's default fetch (no browser impersonation), same as the scraper.
const url = "https://viettelstore.vn/dien-thoai/iphone-17-256gb-pid355077.html";
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const price = (await res.text()).match(/"price"\s*:\s*"?(\d{6,})/)?.[1];
  console.log(`VIETTEL: HTTP ${res.status} ${price ? "OK price=" + price : "BLOCKED"}`);
} catch (e) {
  console.log("VIETTEL: ERROR " + e.message);
}
