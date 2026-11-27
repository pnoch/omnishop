import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoisted holder so the mocked fetchAndParse can call the test's resilientFetch
// mock (module-local bindings cannot be intercepted by vi.mock).
const __resilientHolder = vi.hoisted(() => ({
  fn: async (_o: unknown): Promise<any> => ({
    status: "ok",
    html: "",
    method: "plain",
  }),
}));
import type { DistributorParser, ScrapeResult } from "../lib/scrapers/types";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

vi.mock("../lib/scrapers/resilient", () => ({
  resilientFetch: vi.fn(),
  fetchAndParse: vi.fn(async (parser: any, model: string) => {
    const outcome = await __resilientHolder.fn({
      parser,
      url: parser.buildSearchUrl(model),
    } as never);
    return {
      result:
        outcome.status === "ok" && outcome.html
          ? parser.parsePrice(outcome.html, model, parser.buildSearchUrl(model))
          : null,
      url: parser.buildSearchUrl(model),
      outcome,
    };
  }),
  createMemoryBreakerStore: vi.fn(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
  })),
}));

vi.mock("../server/notifications", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../server/notifications")>();
  return { ...actual, evaluateNotifications: vi.fn(async () => {}) };
});

vi.mock("../server/price-history", () => ({
  recordHistoryPoint: vi.fn(),
  getHistory: vi.fn(async () => []),
  mergeHistory: vi.fn(),
  purgeOldHistory: vi.fn(),
  clearHistoryForTests: vi.fn(),
}));

vi.mock("../server/product-images", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../server/product-images")>();
  return {
    ...actual,
    getProductImage: vi.fn(),
    listProductsMissingImage: vi.fn(async () => []),
  };
});

vi.mock("../server/catalog-warmer", () => ({
  buildCatalogPairs: vi.fn(() => []),
  pickPairsToWarm: vi.fn(() => []),
}));

vi.mock("../server/price-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/price-cache")>();
  return {
    ...actual,
    getCachedPrice: vi.fn(),
    setCachedPrice: vi.fn(),
    listNearExpiry: vi.fn(),
    clearPriceCacheForTests: vi.fn(),
    getAllFetchedAt: vi.fn(async () => ({})),
    purgeStalePriceCache: vi.fn(),
  };
});

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { resilientFetch } from "../lib/scrapers/resilient";
import {
  listNearExpiry,
  purgeStalePriceCache,
  setCachedPrice,
} from "../server/price-cache";
import { purgeOldHistory } from "../server/price-history";
import {
  getNearExpiryStatus,
  orderNearExpiryEntries,
  refreshNearExpiry,
  startWarmer,
  runWarmerTick,
} from "../server/prices";
import { evaluateNotifications } from "../server/notifications";

const mockedGetParser = vi.mocked(getParserByDistributorId);
const mockedFetch = vi.mocked(resilientFetch);
__resilientHolder.fn = mockedFetch as unknown as typeof __resilientHolder.fn;
const mockedListNearExpiry = vi.mocked(listNearExpiry);
const mockedSetCached = vi.mocked(setCachedPrice);

const parser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/shop?q=${model}`,
  parsePrice: () => null,
  rateLimitMs: 0,
};

const scrapeResult: ScrapeResult = {
  price: 88.5,
  currency: "MYR",
  stockStatus: "in_stock",
  url: "https://server2u.com/p/1",
};

describe("warmer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue(parser);
    parser.parsePrice = () => scrapeResult;
    mockedFetch.mockResolvedValue({
      status: "ok",
      html: "<html>price</html>",
      method: "plain",
    });
    mockedSetCached.mockResolvedValue(undefined);
  });

  it("refreshNearExpiry refreshes near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "server2u-my", modelNumber: "CRS804", fetchedAt: 0 },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedSetCached).toHaveBeenCalledTimes(1);
    expect(getNearExpiryStatus()).toMatchObject({
      attempted: 1,
      refreshed: 1,
      failed: 0,
      backedOff: 0,
    });
  });

  it("refreshNearExpiry skips when there are no near-expiry entries", async () => {
    mockedListNearExpiry.mockResolvedValue([]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("refreshNearExpiry refreshes multiple entries in one wave", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "a", modelNumber: "m1", fetchedAt: 0 },
      { distributorId: "b", modelNumber: "m2", fetchedAt: 0 },
    ]);
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("retries a recently attempted pair instead of dropping it", async () => {
    mockedListNearExpiry.mockResolvedValue([
      { distributorId: "server2u-my", modelNumber: "CRS804", fetchedAt: 0 },
    ]);
    await refreshNearExpiry(Date.now());
    await refreshNearExpiry(Date.now());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("backs off a pair after three failed refreshes", async () => {
    const entry = {
      distributorId: "backoff",
      modelNumber: "dead",
      fetchedAt: 0,
    };
    mockedListNearExpiry.mockResolvedValue([entry]);
    parser.parsePrice = () => null;
    const now = Date.now();
    for (let i = 0; i < 3; i++) await refreshNearExpiry(now + i);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(getNearExpiryStatus()).toMatchObject({ attempted: 1, failed: 1 });

    await refreshNearExpiry(now + 10);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(getNearExpiryStatus()).toMatchObject({
      attempted: 0,
      refreshed: 0,
      failed: 0,
      backedOff: 1,
    });
  });

  it("sends recently attempted pairs behind fresher ones", () => {
    const entries = [
      { distributorId: "a", modelNumber: "1", fetchedAt: 90_000 },
      { distributorId: "b", modelNumber: "2", fetchedAt: 80_000 },
      { distributorId: "c", modelNumber: "3", fetchedAt: 70_000 },
    ];
    // `a` failed recently; its rank becomes the attempt time, so it moves
    // behind the older successful rows.
    const attempts = new Map([
      ["a:1", { at: 200_000, failures: 0, backoffUntil: 0 }],
    ]);
    const ordered = orderNearExpiryEntries(entries, attempts);
    expect(ordered.map((entry) => entry.distributorId)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("startWarmer returns a no-op stop function in test env", () => {
    const stop = startWarmer({ intervalMs: 10 });
    expect(typeof stop).toBe("function");
    stop();
  });
});

describe("runWarmerTick reentrancy", () => {
  it("skips a concurrent tick while one is already running", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(evaluateNotifications).mockImplementation(async () => {
      await gate;
    });
    mockedListNearExpiry.mockResolvedValue([]);

    const firstP = runWarmerTick();
    const secondP = runWarmerTick();
    release();
    await Promise.all([firstP, secondP]);
    expect(vi.mocked(evaluateNotifications)).toHaveBeenCalledTimes(1);
  });
});

describe("runWarmerTick step isolation", () => {
  it("continues later steps when an earlier one throws", async () => {
    vi.mocked(purgeOldHistory).mockRejectedValueOnce(new Error("db down"));
    vi.mocked(purgeStalePriceCache).mockClear();
    await runWarmerTick();
    // Without a per-step boundary the single shared catch skipped every later
    // purge for the rest of the tick.
    expect(purgeStalePriceCache).toHaveBeenCalled();
  });
});
