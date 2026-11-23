// Web has no WebView bridge, so a Shopee listing page can never be read there.
// Returning null keeps the probe "unverified" and keeps cheerio out of the
// browser bundle.
export interface ShopeePrice {
  price: number;
  currency: "THB";
  variantName: string | null;
  inStock: boolean;
}

export function parseShopeePrice(
  _html: string,
  _shopId: string,
  _itemId: string,
): ShopeePrice | null {
  return null;
}
