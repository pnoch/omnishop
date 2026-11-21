import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
  parsePriceFromText,
  findPriceElement,
  inferStockStatus,
  modelMismatch,
  titleMatchesModel,
} from "./utils";
import { getTaxRate } from "../tax";

const BASE_URL = "https://linitx.com";

function parseSearchResults(
  $: cheerio.CheerioAPI,
  model: string,
  fallbackUrl: string,
): ScrapeResult | null {
  const candidates: (ScrapeResult & { title: string })[] = [];
  for (const row of $("#results .pure-g").toArray()) {
    const $row = $(row);
    const $title = $row.find("p.title a").first();
    const title = ($title.attr("title") ?? $title.text()).trim();
    if (!title) continue;
    if (!titleMatchesModel(title, model)) continue;

    const price = parsePriceFromText($row.find(".price").first().text());
    if (!price) continue;

    const href = $title.attr("href");
    let url = fallbackUrl;
    if (href) {
      try {
        url = new URL(href, BASE_URL).href;
      } catch {
        // keep the search URL
      }
    }
    candidates.push({
      title,
      price,
      currency: "GBP",
      stockStatus: inferStockStatus($row.find(".stock").first().text()),
      url,
      taxRate: getTaxRate("United Kingdom"),
    });
  }
  if (candidates.length === 0) return null;
  const inStock = candidates.filter((c) => c.stockStatus === "in_stock");
  const pool = inStock.length > 0 ? inStock : candidates;
  const best = pool.reduce((a, b) => (b.price < a.price ? b : a));
  const { title: _title, ...result } = best;
  return result;
}

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  // A search page must be resolved per result row. Falling back to the first
  // price after a failed match would pick up whatever decoy the page lists
  // first.
  if (model) {
    const result = parseSearchResults($, model, url);
    if (result) return result;
    if ($("#results").length > 0) return null;
  }

  const $price = findPriceElement($, ".prodprice, .product__price, .price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".prodinfo-stock-view-status, .product__stock, .stock")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "GBP",
    stockStatus,
    url,
    taxRate: getTaxRate("United Kingdom"),
  };
}

export const linitxParser: DistributorParser = {
  id: "linitx-uk",
  baseUrl: BASE_URL,
  buildSearchUrl: (model) =>
    `https://linitx.com/search.php?keywords=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? BASE_URL, model),
  rateLimitMs: 3000,
  // The storefront blocks plain HTTP and its results are JS-rendered; it parses
  // fine from the rendered DOM (verified), so render it in the browser.
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price",
  },
};

export async function scrapeLinitx(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = linitxParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, linitxParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}
