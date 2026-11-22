import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
  parsePriceFromText,
  findPriceElement,
  inferStockStatus,
  modelMismatch,
} from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = findPriceElement($, ".price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  // Scope stock to the matched card; the page's first `.stock_status` belongs
  // to a different result.
  const $card = $price.closest(".product-item, .product-item-info, li");
  const stockText =
    $card.find(".stock_status, .stock-status").first().text() ||
    $(".stock_status, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Poland"),
  };
}

export const interprojektParser: DistributorParser = {
  id: "interprojekt-pl",
  baseUrl: "https://interprojekt.pl",
  buildSearchUrl: (model) =>
    `https://interprojekt.pl/en/catalogsearch/result/?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://interprojekt.pl", model),
  rateLimitMs: 3000,
};

export async function scrapeInterprojekt(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = interprojektParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, interprojektParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}
