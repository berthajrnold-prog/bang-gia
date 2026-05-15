import axios from "axios";
import * as cheerio from "cheerio";

const url = "https://chungmobile.com/product/iphone-16-hang-loai-b-qua-tang-len-den-2-trieu/";
const res = await axios.get(url, {
  headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/124.0" },
});
const html = res.data;
const $ = cheerio.load(html);

const form = $("form.variations_form, .variations_form").first();
const dataAttr = form.attr("data-product_variations");
console.log("data-product_variations exists:", !!dataAttr);
if (dataAttr) {
  // Decode HTML entities
  const decoded = dataAttr.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  try {
    const variations = JSON.parse(decoded);
    console.log("Variations count:", variations.length);
    for (const v of variations.slice(0, 5)) {
      console.log({
        attributes: v.attributes,
        display_price: v.display_price,
        price_html: v.price_html?.replace(/<[^>]+>/g, "").trim(),
      });
    }
  } catch (e) {
    console.log("Parse error:", e.message);
    console.log("First 500 chars:", decoded.slice(0, 500));
  }
}
