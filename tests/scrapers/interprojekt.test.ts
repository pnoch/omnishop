import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { interprojektParser } from "../../lib/scrapers/interprojekt";

const FIXTURES_DIR = path.join(__dirname, "../fixtures/scrapers");

describe("Interprojekt Parser", () => {
  it("should have correct parser config", () => {
    expect(interprojektParser.id).toBe("interprojekt-pl");
    expect(interprojektParser.baseUrl).toBe("https://interprojekt.pl");
    expect(interprojektParser.rateLimitMs).toBe(3000);
  });

  it("should build correct search URL", () => {
    const url = interprojektParser.buildSearchUrl("hAP ac3");
    expect(url).toBe(
      "https://interprojekt.pl/en/catalogsearch/result/?q=hAP%20ac3",
    );
  });

  it("should return null for 404 page fixture", () => {
    const fixturePath = path.join(FIXTURES_DIR, "interprojekt-pl.html");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf-8");
    const result = interprojektParser.parsePrice(html);
    expect(result).toBeNull();
  });

  it("should return null for invalid HTML", () => {
    const result = interprojektParser.parsePrice(
      "<html><body>No price here</body></html>",
    );
    expect(result).toBeNull();
  });

  it("should extract price, stock status, and currency from valid HTML", () => {
    const html = `<div><span class="price">€199.00</span><span class="stock-status">In Stock</span></div>`;
    const result = interprojektParser.parsePrice(html);
    expect(result).not.toBeNull();
    expect(result!.price).toBe(199.0);
    expect(result!.currency).toBe("EUR");
    expect(result!.stockStatus).toBe("in_stock");
  });

  // The stock text came from the first `.stock_status` on the page, so any
  // result whose price was not the first card paired with the wrong stock.
  it("reads stock from the matched card, not the first result", () => {
    const card = (sku: string, price: string, stock: string) => `
      <li class="item product product-item">
        <a class="product-item-link">${sku} Access Point</a>
        <span class="price">€${price}</span>
        <span class="stock_status">${stock}</span>
      </li>`;
    const html = `<ol class="products list items product-items">
      ${card("AAA-111", "99.00", "Out of stock")}
      ${card("BBB-222", "249.00", "In stock")}
    </ol>`;
    const result = interprojektParser.parsePrice(html, "BBB-222");
    expect(result?.price).toBe(249);
    expect(result?.stockStatus).toBe("in_stock");
  });
});
