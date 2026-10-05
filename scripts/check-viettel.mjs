// Checks whether Viettel Store serves product HTML to this server's IP (Akamai bot block)
import axios from "axios";

const url = "https://viettelstore.vn/dien-thoai/iphone-17-256gb-pid355077.html";
try {
  const res = await axios.get(url, {
    timeout: 20000,
    responseType: "text",
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      "Accept-Language": "vi-VN,vi;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  const price = String(res.data).match(/"price"\s*:\s*"?(\d{6,})/)?.[1];
  console.log(`VIETTEL: HTTP ${res.status} ${price ? "OK price=" + price : "BLOCKED"}`);
} catch (e) {
  console.log("VIETTEL: ERROR " + e.message);
}
