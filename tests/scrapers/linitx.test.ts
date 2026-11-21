import { describe, it, expect } from "vitest";
import { linitxParser } from "../../lib/scrapers/linitx";

describe("Linitx Parser", () => {
  it("should have correct parser config", () => {
    expect(linitxParser.id).toBe("linitx-uk");
    expect(linitxParser.baseUrl).toBe("https://linitx.com");
    expect(linitxParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = linitxParser.buildSearchUrl("hAP ac3");
    expect(url).toBe("https://linitx.com/search.php?keywords=hAP%20ac3");
  });

  it("should return null for invalid HTML", () => {
    const result = linitxParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="product__price">£299.00</span><span class="product__stock">In Stock</span></div>`;
    const result = linitxParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(299.0);
    expect(result!.currency).toBe("GBP");
    expect(result!.stockStatus).toBe("in_stock");
  });
});


describe("model verification", () => {
  const MODEL = "CRS804-4DDQ-hRM";
  const MATCH_HTML = `<html><body><table><tr class="product">
    <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
    <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
    <td><span class="stock-status availability stock">In Stock</span></td>
  </tr></table></body></html>`;
  const MISMATCH_HTML = MATCH_HTML.replace(
    /crs804-4ddq-hrm/g,
    "crs326-24g-2s-plus",
  ).replace(/CRS804-4DDQ-hRM/g, "CRS326-24G-2S+");

  it("accepts a row that names the requested model", () => {
    const result = linitxParser.parsePrice(MATCH_HTML, MODEL);
    expect(result).not.toBeNull();
    expect(result?.price).toBe(480);
    expect(result?.stockStatus).toBe("in_stock");
  });

  it("returns null when the priced row names a different product", () => {
    expect(linitxParser.parsePrice(MISMATCH_HTML, MODEL)).toBeNull();
  });

  it("ignores verification when no model is passed", () => {
    expect(linitxParser.parsePrice(MISMATCH_HTML)?.price).toBe(480);
  });
});

// Linitx search results include service plans whose titles contain the model.
// Reading the first price/stock on the page reported "UI CARE for UCG-Ultra"
// (£18.46, 99 in stock) as the £104.39 gateway, and the app alerted on it.
describe("search results with accessory listings", () => {
  const MODEL = "UCG-Ultra";
  const HTML = `<html><body>
    <h3>Search results for 'UCG-Ultra'</h3>
    <div id="results">
      <div class="pure-g">
        <p class="title"><a title="Ubiquiti UI CARE for UCG-Ultra" href="/product/ubiquiti-ui-care-for-ucg-ultra/18686">Ubiquiti UI CARE for UCG-Ultra</a></p>
        <span class="stock prodview instock">99 In Stock</span>
        <span class="price">£18.46</span>
      </div>
      <div class="pure-g">
        <p class="title"><a title="Ubiquiti UniFi Cloud Gateway Ultra - UCG-Ultra - UK Converter" href="/product/ubiquiti-unifi-cloud-gateway-ultra-ucg-ultra-uk-converter/17876">Ubiquiti UniFi Cloud Gateway Ultra - UCG-Ultra - UK Converter</a></p>
        <span class="stock prodview awaiting">Awaiting Restock</span>
        <span class="price">£104.39</span>
      </div>
    </div>
  </body></html>`;

  it("skips the care plan and prices the requested product", () => {
    const result = linitxParser.parsePrice(
      HTML,
      MODEL,
      "https://linitx.com/search.php?keywords=UCG-Ultra",
    );
    expect(result).not.toBeNull();
    expect(result!.price).toBe(104.39);
    expect(result!.stockStatus).toBe("back_order");
    expect(result!.url).toBe(
      "https://linitx.com/product/ubiquiti-unifi-cloud-gateway-ultra-ucg-ultra-uk-converter/17876",
    );
  });
});

// A model can be a prefix of a different product ("U7-Pro" vs "U7-Pro-Wall",
// "USW-Flex" vs "USW-Flex-Mini"). Matching the prefix reported a £38.39 wall
// mount and a £27.59 Flex Mini as the requested devices.
describe("search results with prefix variants", () => {
  const row = (title: string, price: string) => `<div class="pure-g">
    <p class="title"><a title="${title}" href="/product/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${title}</a></p>
    <span class="stock">In Stock</span>
    <span class="price">${price}</span>
  </div>`;

  it("prefers the U7 Pro over the U7 Pro Wall mount", () => {
    const html = `<div id="results">
      ${row("Ubiquiti UniFi U7 Pro Wall Paintable Flush Mount - UACC-U7-Pro-Wall-FM", "£38.39")}
      ${row("Ubiquiti UniFi U7 Pro WiFi 7 Access Point - U7-Pro", "£166.34")}
    </div>`;
    const result = linitxParser.parsePrice(html, "U7-Pro");
    expect(result?.price).toBe(166.34);
  });

  it("prefers the USW Flex over the Flex Mini", () => {
    const html = `<div id="results">
      ${row("OPEN BOX Ubiquiti UniFi Flex Mini 5 Port Network Switch - USW-FLEX-Mini", "£27.59")}
      ${row("Ubiquiti UniFi Flex Indoor / Outdoor 5 Port Switch - USW-Flex", "£104.39")}
    </div>`;
    const result = linitxParser.parsePrice(html, "USW-Flex");
    expect(result?.price).toBe(104.39);
  });

  it("prefers new stock over an open-box listing", () => {
    const html = `<div id="results">
      ${row("OPEN BOX Ubiquiti UniFi U7 Pro WiFi 7 Access Point - U7-Pro", "£162.00")}
      ${row("Ubiquiti UniFi U7 Pro WiFi 7 Access Point - U7-Pro", "£166.34")}
    </div>`;
    const result = linitxParser.parsePrice(html, "U7-Pro");
    expect(result?.price).toBe(166.34);
  });

  it("still matches the requested Wall variant", () => {
    const html = `<div id="results">
      ${row("Ubiquiti UniFi U7 Pro Wall Paintable Flush Mount - UACC-U7-Pro-Wall-FM", "£38.39")}
      ${row("Ubiquiti UniFi U7 Pro Wall WiFi 7 Access Point - U7-Pro-Wall", "£193.19")}
    </div>`;
    const result = linitxParser.parsePrice(html, "U7-Pro-Wall");
    expect(result?.price).toBe(193.19);
  });
});
