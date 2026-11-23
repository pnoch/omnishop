import { checkPriceAnomaly } from "./alert-integrity";

export type AnomalyGuardResult =
  | { accept: true }
  | { accept: false; reason: "far_below_history" | "far_above_history" };

// A single misparsed scrape must not overwrite a good price. A real clearance
// drop is confirmed by the next check, so require two readings in the same band
// before accepting an outlier. The window covers a daily check schedule.
const PENDING_TTL_MS = 48 * 60 * 60 * 1000;
const CONFIRM_RATIO = 0.1;
const MAX_PENDING = 1000;

type Pending = { price: number; at: number };
const pending = new Map<string, Pending>();

function prune(now: number): void {
  for (const [key, value] of pending) {
    if (now - value.at > PENDING_TTL_MS) pending.delete(key);
  }
  while (pending.size > MAX_PENDING) {
    const oldest = pending.keys().next().value;
    if (!oldest) break;
    pending.delete(oldest);
  }
}

/**
 * Decides whether a freshly scraped price may replace the stored price/history.
 * `key` identifies the distributor and model. The first outlier is held; a
 * second reading within 10% of it confirms a real move.
 */
export function guardPriceAgainstHistory(
  key: string,
  price: number,
  history: number[],
  now: number = Date.now(),
): AnomalyGuardResult {
  const anomaly = checkPriceAnomaly(price, history);
  if (!anomaly.suspicious) {
    pending.delete(key);
    return { accept: true };
  }
  const previous = pending.get(key);
  if (
    previous &&
    now - previous.at <= PENDING_TTL_MS &&
    Math.abs(price - previous.price) <=
      Math.max(previous.price, price) * CONFIRM_RATIO
  ) {
    pending.delete(key);
    return { accept: true };
  }
  pending.set(key, { price, at: now });
  prune(now);
  return {
    accept: false,
    reason: anomaly.reason ?? "far_below_history",
  };
}

export function clearPriceAnomalyGuardForTests(): void {
  pending.clear();
}
