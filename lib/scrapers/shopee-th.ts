import type { DistributorParser, ScrapeResult } from "./types";
import { parseShopeePrice } from "./shopee-price";

export { parseShopeePrice } from "./shopee-price";
export type { ShopeePrice } from "./shopee-price";

function modelIds(model?: string): { shopId: string; itemId: string } | null {
  const m = model?.match(/^shopee-th-([1-9]\d{0,19})-([1-9]\d{0,19})$/);
  return m ? { shopId: m[1]!, itemId: m[2]! } : null;
}

function parseProductPage(
  html: string,
  url: string | undefined,
  shopId: string,
  itemId: string,
): ScrapeResult | null {
  const found = parseShopeePrice(html, shopId, itemId);
  if (!found) return null;
  return {
    price: found.price,
    currency: "THB",
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    url: url ?? "https://shopee.co.th",
    variantName: found.variantName ?? undefined,
  };
}

export const shopeeThParser: DistributorParser = {
  id: "shopee-th",
  baseUrl: "https://shopee.co.th",
  buildSearchUrl: (model) => {
    const ids = modelIds(model);
    return ids
      ? `https://shopee.co.th/product/${ids.shopId}/${ids.itemId}`
      : "https://shopee.co.th";
  },
  parsePrice: (html, model, url) => {
    const ids = modelIds(model);
    if (!ids) return null;
    return parseProductPage(html, url, ids.shopId, ids.itemId);
  },
  rateLimitMs: 60000,
  useBrowser: true,
};
