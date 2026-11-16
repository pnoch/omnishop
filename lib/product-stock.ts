import type { Product, StockStatus } from "./types";

const STOCK_ORDER: Record<StockStatus, number> = {
  in_stock: 0,
  back_order: 1,
  out_of_stock: 2,
  unknown: 3,
};

/** The most useful status across a product's listings. */
export function getBestStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (!listings.length) return "unknown";
  return [...listings].sort(
    (a, b) => STOCK_ORDER[a.stockStatus] - STOCK_ORDER[b.stockStatus],
  )[0]!.stockStatus;
}

export interface StockCounts {
  inStock: number;
  backOrder: number;
  outOfStock: number;
  unknown: number;
}

/** Per-product counts for the home summary tiles. */
export function countStockStatuses(products: Product[]): StockCounts {
  const counts: StockCounts = {
    inStock: 0,
    backOrder: 0,
    outOfStock: 0,
    unknown: 0,
  };
  for (const product of products) {
    const status = getBestStatus(product);
    if (status === "in_stock") counts.inStock += 1;
    else if (status === "back_order") counts.backOrder += 1;
    else if (status === "out_of_stock") counts.outOfStock += 1;
    else counts.unknown += 1;
  }
  return counts;
}
