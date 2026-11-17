import type { DistributorListing, StockStatus } from "./types";

/**
 * Authoritative stock status for the product-detail header. It follows the
 * listings the user can actually see after the region filter, not the cheapest
 * listing. A quote-only or unconvertible-price listing still counts as in stock.
 */
export function deriveHeaderStockStatus(
  visibleListings: Pick<DistributorListing, "stockStatus">[],
): StockStatus {
  if (visibleListings.some((listing) => listing.stockStatus === "in_stock")) {
    return "in_stock";
  }
  if (visibleListings.some((listing) => listing.stockStatus === "back_order")) {
    return "back_order";
  }
  if (visibleListings.length > 0) return "out_of_stock";
  return "unknown";
}
