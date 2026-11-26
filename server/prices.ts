import { getParserByDistributorId } from "../lib/scrapers/registry";
import { createSemaphore } from "../lib/concurrency";
import {
  createMemoryBreakerStore,
  fetchAndParse,
} from "../lib/scrapers/resilient";
import type { PriceSnapshot, ServerPriceResult } from "../lib/types";
import {
  getCachedPrice,
  setCachedPrice,
  listNearExpiry,
  purgeStalePriceCache,
  getAllFetchedAt,
} from "./price-cache";
import {
  getHistory,
  recordHistoryPoint,
  purgeOldHistory,
} from "./price-history";
import { buildCatalogPairs, pickPairsToWarm } from "./catalog-warmer";
import { getProductImage, listProductsMissingImage, purgeOrphanedImages } from "./product-images";
import { purgeOrphanedInsights } from "./price-insights";
import { evaluateNotifications, purgeOldNotificationEvents } from "./notifications";
import { purgeOldEmailLog } from "./notifications/email-alerts";
import { purgeOldWebhookLog } from "./notifications/webhook-alerts";
import { purgeExpiredAuthTokens } from "./db";
import { purgeOldRevokedDevices } from "./devices";
import { PRICE_SNAPSHOT_TTL_MS } from "../shared/const";
import { guardPriceAgainstHistory } from "../lib/price-anomaly-guard";

export const PRICE_TTL_MS = PRICE_SNAPSHOT_TTL_MS; // 1 hour
const WARMER_INTERVAL_MS = 5 * 60 * 1000; // every 5 min
const WARMER_LEAD_MS = 10 * 60 * 1000; // refresh 10 min before expiry
const CATALOG_WARM_PER_TICK = 3;
const IMAGES_PER_TICK = 2;

const inFlight = new Map<string, Promise<PriceSnapshot | null>>();
const breakerStore = createMemoryBreakerStore();

// `prices.get` is public and triggers a real outbound scrape on a cache miss.
// Per-IP rate limits bound one caller, but rotating IPs could still fan out to
// unbounded concurrent scrapes (each up to 25 distributors). This global
// semaphore caps total in-flight scrapes per process; excess requests queue
// rather than being dropped, and the single-flight map still dedupes identical
// (distributor, model) requests.
const MAX_CONCURRENT_SCRAPES = 6;
// Bound the queue: public `prices.get` can request unlimited distinct
// (distributor, model) pairs, and an unbounded queue grows memory/latency
// instead of shedding load. Over the cap, reject so the caller falls back to
// the cached value / a miss.
const MAX_QUEUED_SCRAPES = 50;
// Shared semaphore: transfers a released slot directly to the waiter. The
// previous decrement-then-wake form let a racing acquire take the freed slot
// too, exceeding MAX_CONCURRENT_SCRAPES.
const scrapeSlots = createSemaphore(MAX_CONCURRENT_SCRAPES, {
  maxQueue: MAX_QUEUED_SCRAPES,
});

function acquireScrapeSlot(): Promise<void> {
  return scrapeSlots.acquire();
}

function releaseScrapeSlot(): void {
  scrapeSlots.release();
}

function cacheKey(distributorId: string, modelNumber: string): string {
  return `${distributorId}:${modelNumber}`;
}

async function refreshPrice(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const parser = getParserByDistributorId(distributorId);
  if (!parser) return null;
  try {
    const { result } = await fetchAndParse(parser, modelNumber, breakerStore);
    if (!result) return null;
    // A plausible absolute price can still be the wrong item (a care plan,
    // mount, or sibling model). Compare against this pair's trusted history and
    // hold a single outlier until the next check confirms it.
    const history = await getHistory(distributorId, modelNumber, {
      trustedOnly: true,
    });
    const guard = guardPriceAgainstHistory(
      `${distributorId}|${modelNumber}`,
      result.price,
      history.map((point) => point.price),
    );
    if (!guard.accept) {
      console.warn(
        `[Prices] Held ${guard.reason} price for ${distributorId}/${modelNumber}: ${result.price}`,
      );
      return getCachedPrice(distributorId, modelNumber);
    }
    const snapshot: PriceSnapshot = { ...result, fetchedAt: Date.now() };
    await setCachedPrice(distributorId, modelNumber, snapshot);
    await recordHistoryPoint(distributorId, modelNumber, snapshot);
    return snapshot;
  } catch (error) {
    console.warn(
      "[Prices] Scrape failed for %s/%s:",
      distributorId,
      modelNumber,
      error,
    );
    return null;
  }
}

function refreshSingleFlight(
  distributorId: string,
  modelNumber: string,
): Promise<PriceSnapshot | null> {
  const key = cacheKey(distributorId, modelNumber);
  const existing = inFlight.get(key);
  if (existing) return existing;
  let acquired = false;
  const promise = acquireScrapeSlot()
    .then(() => {
      acquired = true;
      return refreshPrice(distributorId, modelNumber);
    })
    .finally(() => {
      // Only release a slot that was actually acquired: acquireScrapeSlot can
      // reject when the queue is full, and releasing then would corrupt the
      // active count (letting concurrency exceed the cap).
      if (acquired) releaseScrapeSlot();
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}

export async function getPrice(
  distributorId: string,
  modelNumber: string,
): Promise<ServerPriceResult> {
  const [cached, history] = await Promise.all([
    getCachedPrice(distributorId, modelNumber),
    getHistory(distributorId, modelNumber),
  ]);
  const fresh =
    cached !== null &&
    cached.fetchedAt <= Date.now() &&
    Date.now() - cached.fetchedAt < PRICE_TTL_MS;
  if (!fresh) {
    // Swallow a queue-full rejection: this is a fire-and-forget warm, and an
    // unhandled rejection would log a stack on every shed request.
    void refreshSingleFlight(distributorId, modelNumber).catch(() => {});
  }
  return { snapshot: cached, history };
}

function pLimit(concurrency: number) {
  const slots = Math.max(1, Math.floor(concurrency) || 1);
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    const fn = queue.shift();
    if (fn) fn();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        // A synchronous throw must not leak the slot or wedge the queue.
        let result: Promise<T>;
        try {
          result = fn();
        } catch (error) {
          next();
          reject(error);
          return;
        }
        result.then(resolve, reject).finally(next);
      };
      if (active < slots) run();
      else queue.push(run);
    });
}

export { pLimit };

const NEAR_EXPIRY_BUDGET_MS = 45_000;
const NEAR_EXPIRY_CONCURRENCY = 3;
const NEAR_EXPIRY_ATTEMPTS_MAX = 5_000;
const NEAR_EXPIRY_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

// Failed scrapes do not update fetchedAt, so the oldest-first query would hand
// the same dead pairs back every tick and starve live rows behind them. Rank
// each pair by the later of its last successful fetch and its last attempt:
// a failed attempt moves it to the back until every older row has been tried
// (the catalog rotation uses the same rule).
const nearExpiryAttempts = new Map<string, number>();

export function orderNearExpiryEntries<
  T extends {
    distributorId: string;
    modelNumber: string;
    fetchedAt?: number;
  },
>(entries: T[], attempts: Map<string, number>): T[] {
  const rank = (entry: T): number =>
    Math.max(
      entry.fetchedAt ?? 0,
      attempts.get(cacheKey(entry.distributorId, entry.modelNumber)) ?? 0,
    );
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

function rememberNearExpiryAttempt(
  entry: { distributorId: string; modelNumber: string },
  at: number,
): void {
  const key = cacheKey(entry.distributorId, entry.modelNumber);
  // Delete first so the map's insertion order stays attempt order.
  nearExpiryAttempts.delete(key);
  nearExpiryAttempts.set(key, at);
  while (nearExpiryAttempts.size > NEAR_EXPIRY_ATTEMPTS_MAX) {
    const oldest = nearExpiryAttempts.keys().next().value;
    if (!oldest) break;
    nearExpiryAttempts.delete(oldest);
  }
}

function pruneNearExpiryAttempts(now: number): void {
  const cutoff = now - NEAR_EXPIRY_ATTEMPT_TTL_MS;
  for (const [key, at] of nearExpiryAttempts) {
    if (at >= cutoff) break;
    nearExpiryAttempts.delete(key);
  }
}

export async function refreshNearExpiry(now: number): Promise<void> {
  const entries = await listNearExpiry(now, PRICE_TTL_MS - WARMER_LEAD_MS);
  const ordered = orderNearExpiryEntries(entries, nearExpiryAttempts);

  // Deadline, not just a count: a slow distributor can make each wave take
  // 10-20 s, and 100 rows then consumed the whole 5-minute window. In-flight
  // scrapes finish; no new wave starts after the budget.
  const startedAt = Date.now();
  for (let i = 0; i < ordered.length; i += NEAR_EXPIRY_CONCURRENCY) {
    if (i > 0 && Date.now() - startedAt >= NEAR_EXPIRY_BUDGET_MS) break;
    const wave = ordered.slice(i, i + NEAR_EXPIRY_CONCURRENCY);
    for (const entry of wave) rememberNearExpiryAttempt(entry, now);
    await Promise.all(
      wave.map((entry) =>
        refreshSingleFlight(
          entry.distributorId,
          entry.modelNumber,
        ).catch(() => null),
      ),
    );
  }
  pruneNearExpiryAttempts(now);
}

// Per-process record of the last warm attempt, so pairs whose scrape never
// resolves still rotate out instead of monopolizing every tick (see
// pickPairsToWarm).
const catalogWarmAttempts = new Map<string, number>();
const imageGenerationAttempts = new Map<string, number>();

export async function warmCatalogRotation(count: number): Promise<number> {
  const pairs = buildCatalogPairs();
  if (pairs.length === 0) return 0;
  const fetchedRows = await getAllFetchedAt();
  const fetchedAtMap = new Map<string, number>();
  for (const row of fetchedRows) {
    fetchedAtMap.set(`${row.distributorId}:${row.modelNumber}`, row.fetchedAt);
  }
  const toWarm = pickPairsToWarm(
    pairs,
    fetchedAtMap,
    count,
    catalogWarmAttempts,
  );
  const attemptedAt = Date.now();
  for (const pair of toWarm) {
    catalogWarmAttempts.set(
      `${pair.distributorId}:${pair.modelNumber}`,
      attemptedAt,
    );
  }
  const limit = pLimit(3);
  await Promise.all(
    toWarm.map((pair) =>
      limit(() =>
        refreshSingleFlight(pair.distributorId, pair.modelNumber),
      ).catch(() => null),
    ),
  );
  return toWarm.length;
}

export async function warmProductImages(count: number): Promise<number> {
  const missing = await listProductsMissingImage();
  // Same rotation as the catalog warmer: a product whose generation keeps
  // failing must not hold the first slots forever.
  const toGenerate = [...missing]
    .sort(
      (a, b) =>
        (imageGenerationAttempts.get(a) ?? 0) -
        (imageGenerationAttempts.get(b) ?? 0),
    )
    .slice(0, count);
  const attemptedAt = Date.now();
  for (const id of toGenerate) imageGenerationAttempts.set(id, attemptedAt);
  const limit2 = pLimit(3);
  await Promise.all(toGenerate.map((productId) => limit2(() => getProductImage(productId))));
  return toGenerate.length;
}

let warmerTickInFlight = false;

export interface WarmerStepStatus {
  name: string;
  durationMs: number;
  ok: boolean;
}

export interface WarmerStatus {
  running: boolean;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastDurationMs: number | null;
  lastOk: boolean | null;
  failedSteps: number;
  steps: WarmerStepStatus[];
}

const warmerStatus: WarmerStatus = {
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastDurationMs: null,
  lastOk: null,
  failedSteps: 0,
  steps: [],
};
let warmerTickFailedSteps = 0;
let warmerTickSteps: WarmerStepStatus[] = [];

/** Last-tick health and per-step timings for `/api/status`; no error text. */
export function getWarmerStatus(): WarmerStatus {
  return {
    ...warmerStatus,
    steps: warmerStatus.steps.map((step) => ({ ...step })),
  };
}

// Each step gets its own error boundary: a single shared catch meant one
// failing step (e.g. a transient DB error in purgeOldHistory) skipped every
// later step in the tick, starving the remaining purges for that run.
async function warmerStep(
  name: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  const startedAt = Date.now();
  let ok = true;
  try {
    await fn();
  } catch (error) {
    ok = false;
    warmerTickFailedSteps += 1;
    console.warn("[Prices] Warmer step failed: %s", name, error);
  }
  warmerTickSteps.push({
    name,
    durationMs: Date.now() - startedAt,
    ok,
  });
}

export async function runWarmerTick(): Promise<void> {
  if (warmerTickInFlight) return;
  warmerTickInFlight = true;
  const startedAt = Date.now();
  warmerTickFailedSteps = 0;
  warmerTickSteps = [];
  warmerStatus.running = true;
  warmerStatus.lastStartedAt = startedAt;
  try {
    await warmerStep("refreshNearExpiry", () => refreshNearExpiry(Date.now()));
    await warmerStep("warmCatalogRotation", () =>
      warmCatalogRotation(CATALOG_WARM_PER_TICK),
    );
    await warmerStep("warmProductImages", () =>
      warmProductImages(IMAGES_PER_TICK),
    );
    await warmerStep("evaluateNotifications", () =>
      evaluateNotifications(Date.now()),
    );
    await warmerStep("purgeOldHistory", () => purgeOldHistory(Date.now()));
    await warmerStep("purgeOldNotificationEvents", () =>
      purgeOldNotificationEvents(Date.now()),
    );
    await warmerStep("purgeOldEmailLog", () => purgeOldEmailLog(Date.now()));
    await warmerStep("purgeOldWebhookLog", () =>
      purgeOldWebhookLog(Date.now()),
    );
    await warmerStep("purgeExpiredAuthTokens", () =>
      purgeExpiredAuthTokens(Date.now()),
    );
    await warmerStep("purgeOrphanedInsights", () => purgeOrphanedInsights());
    await warmerStep("purgeOrphanedImages", () => purgeOrphanedImages());
    await warmerStep("purgeStalePriceCache", () =>
      purgeStalePriceCache(Date.now()),
    );
    await warmerStep("purgeOldRevokedDevices", () =>
      purgeOldRevokedDevices(Date.now()),
    );
  } catch (error) {
    warmerTickFailedSteps += 1;
    console.warn("[Prices] Warmer tick failed:", error);
  } finally {
    warmerTickInFlight = false;
    const finishedAt = Date.now();
    warmerStatus.running = false;
    warmerStatus.lastFinishedAt = finishedAt;
    warmerStatus.lastDurationMs = finishedAt - startedAt;
    warmerStatus.failedSteps = warmerTickFailedSteps;
    warmerStatus.lastOk = warmerTickFailedSteps === 0;
    warmerStatus.steps = warmerTickSteps;
  }
}

let warmerTimer: ReturnType<typeof setInterval> | null = null;

// Singleton: a second call while the warmer runs returns a no-op cleanup
// (it does NOT stop the timer — ownership stays with the first caller).
export function startWarmer(opts?: { intervalMs?: number }): () => void {
  const intervalMs = opts?.intervalMs ?? WARMER_INTERVAL_MS;
  if (process.env.NODE_ENV === "test") return () => {};
  if (warmerTimer) return () => {};
  warmerTimer = setInterval(() => {
    void runWarmerTick();
  }, intervalMs);
  return () => {
    if (warmerTimer) clearInterval(warmerTimer);
    warmerTimer = null;
  };
}
