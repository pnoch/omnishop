import { isAcquired } from "./acquired";
import { selectBestListing } from "./currency";
import { isAutomaticProduct } from "./marketplace";
import { bestPricePoints } from "./product-insights";
import type { AppSettings, Product } from "./types";

export type WatchlistDropRule = NonNullable<AppSettings["watchlistDropRule"]>;

export const DEFAULT_WATCHLIST_DROP_RULE: WatchlistDropRule = {
  enabled: false,
  percent: 10,
  windowHours: 24,
};

export const WATCHLIST_DROP_PERCENTS = [5, 10, 15, 20] as const;
export const WATCHLIST_DROP_WINDOWS = [24, 168] as const;

export interface WatchlistDropTrigger {
  productId: string;
  productName: string;
  currentPrice: number;
  baselinePrice: number;
  dropPercent: number;
  currency: string;
}

const HOUR_MS = 60 * 60 * 1000;

export function watchlistDropWindowMs(rule: WatchlistDropRule): number {
  return (rule.windowHours === 168 ? 168 : 24) * HOUR_MS;
}

/**
 * Notify when a product's current best in-stock price is at least `percent`
 * below its best in-stock price at the start of the window. The comparison
 * uses the latest historical point at/before the cutoff within one window
 * (daily history means yesterday's point can be up to a day before the cutoff);
 * older or missing history is skipped rather than compared to a different era. Pure so the rule can be tested and previewed without a scrape.
 */
export function evaluateWatchlistDropRule(
  products: Product[],
  rule: WatchlistDropRule,
  currency: string,
  now: number = Date.now(),
): WatchlistDropTrigger[] {
  if (!rule.enabled || !(rule.percent > 0) || rule.percent >= 100) return [];
  const windowMs = watchlistDropWindowMs(rule);
  const cutoff = now - windowMs;
  const tolerance = windowMs;
  const triggers: WatchlistDropTrigger[] = [];

  for (const product of products) {
    if (isAcquired(product) || !isAutomaticProduct(product)) continue;
    const listings = product.listings ?? [];
    const current = selectBestListing(listings, {
      currency,
      stock: "in_stock",
    });
    if (!current) continue;

    const points = bestPricePoints(listings, currency);
    let baseline: number | null = null;
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i]!;
      if (point.t > cutoff) continue;
      if (point.t >= cutoff - tolerance) baseline = point.v;
      break;
    }
    if (baseline === null || !(baseline > 0)) continue;

    const drop = ((baseline - current.price) / baseline) * 100;
    if (drop + 0.001 < rule.percent) continue;
    triggers.push({
      productId: product.id,
      productName: product.name,
      currentPrice: current.price,
      baselinePrice: baseline,
      dropPercent: Math.round(drop * 10) / 10,
      currency,
    });
  }

  return triggers.sort((a, b) => b.dropPercent - a.dropPercent);
}

/** One notification per product per rule window (changing the rule re-arms). */
export function watchlistDropEventId(
  trigger: Pick<WatchlistDropTrigger, "productId">,
  rule: WatchlistDropRule,
  now: number = Date.now(),
): string {
  const windowMs = watchlistDropWindowMs(rule);
  const bucket = Math.floor(now / windowMs);
  return `watchlist-drop:${trigger.productId}:${rule.percent}:${rule.windowHours}:${bucket}`;
}
