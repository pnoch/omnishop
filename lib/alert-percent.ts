import { formatPrice } from "@shared/currency";
import { convertPrice, hasExchangeRate } from "./currency";
import type { DistributorListing, PriceAlert } from "./types";

/** Quick “drop by” presets shown in the alert sheet. */
export const ALERT_PERCENT_PRESETS = [5, 10, 15, 20] as const;

export function percentTargetPrice(
  baseline: number,
  percent: number,
): number | null {
  if (!(baseline > 0) || !(percent > 0) || percent >= 100) return null;
  return Math.round(baseline * (1 - percent / 100) * 100) / 100;
}

/**
 * Best in-stock price for the alert's scope, converted to the alert currency.
 * Percentage alerts are relative to this at creation; a missing FX rate or no
 * in-stock listing hides the presets instead of guessing.
 */
export function bestAlertBaseline(
  listings: DistributorListing[],
  distributorId: string | null | undefined,
  currency: string,
): number | null {
  if (!hasExchangeRate(currency)) return null;
  const scoped = distributorId
    ? listings.filter((listing) => listing.distributorId === distributorId)
    : listings;
  let best = Infinity;
  for (const listing of scoped) {
    if (listing.stockStatus !== "in_stock" || !(listing.price > 0)) continue;
    if (!hasExchangeRate(listing.currency)) return null;
    const converted = convertPrice(listing.price, listing.currency, currency);
    if (converted !== null && converted < best) best = converted;
  }
  return Number.isFinite(best) ? Math.round(best * 100) / 100 : null;
}

/** “10% below $451.09” for an alert created from a percentage preset. */
export function alertPercentLabel(
  alert: Pick<PriceAlert, "dropPercent" | "baselinePrice" | "currency">,
): string | null {
  if (
    !alert.dropPercent ||
    !(alert.dropPercent > 0) ||
    !alert.baselinePrice ||
    !(alert.baselinePrice > 0)
  ) {
    return null;
  }
  return `${alert.dropPercent}% below ${formatPrice(alert.baselinePrice, alert.currency)}`;
}
