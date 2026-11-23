import type { DistributorParser } from "./types";
import { PARSER_SITES } from "./parser-sites";

// Web build stand-in for the real parser set. Browser device-scraping cannot
// work against these distributors (their sites send no CORS headers), so
// shipping 28 HTML parsers and cheerio to the web bundle buys nothing. The ids
// and origins stay real so health and discovery still enumerate the catalog.
export function createWebParsers(): DistributorParser[] {
  return PARSER_SITES.map((site) => ({
    id: site.id,
    baseUrl: site.baseUrl,
    buildSearchUrl: (model: string) =>
      `${site.baseUrl}/search?q=${encodeURIComponent(model)}`,
    parsePrice: () => null,
    rateLimitMs: 0,
  }));
}

export const WEB_PARSERS = createWebParsers();
