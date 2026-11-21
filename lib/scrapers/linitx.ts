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

const BASE_URL = "https://linitx.com";

// Search results mix in service plans, accessories, and sibling models whose
// titles contain the requested model as a prefix: U7-Pro vs U7-Pro-Wall,
// USW-Flex vs USW-Flex-Mini. Taking the first price on the page reported a
// £18.46 care plan, a £38.39 wall mount, and a £27.59 Flex Mini as the real
// products.
const ACCESSORY_TITLE =
  /\b(mount|stand|enclosure|cover|case|bracket|plate|rail|flush|paintable|weatherproof|care|warranty|licen[cs]e|subscription|power supply|psu|cable|adapter)\b/i;

// The app compares new stock. An open-box unit is a real offer but not the same
// product condition, and its price would trigger misleading drop alerts.
const NON_NEW_TITLE = /\b(open box|opened box|refurbished|refurb|used|ex[ -]display)\b/i;

const VARIANT_SUFFIXES = new Set([
  "wall",
  "mini",
  "max",
  "utility",
  "xg",
  "poe",
  "plus",
  "pro",
  "se",
  "ultra",
  "enterprise",
  "outdoor",
  "industrial",
  "mesh",
  "lite",
  "hd",
  "lr",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// True only when the title names the requested model and does not continue
// into a different variant. "… - U7-Pro" passes; "… U7 Pro Wall" does not.
export function titleMatchesModel(title: string, model: string): boolean {
  if (ACCESSORY_TITLE.test(title)) return false;
  if (NON_NEW_TITLE.test(title)) return false;
  const titleTokens = tokenize(title);
  const modelTokens = tokenize(model);
  if (modelTokens.length === 0) return true;
  for (let i = 0; i + modelTokens.length <= titleTokens.length; i++) {
    let matched = true;
    for (let j = 0; j < modelTokens.length; j++) {
      if (titleTokens[i + j] !== modelTokens[j]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    const next = titleTokens[i + modelTokens.length];
    if (!next) return true;
    if (/^\d+$/.test(next)) continue;
    if (VARIANT_SUFFIXES.has(next)) continue;
    return true;
  }
  return false;
}

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
