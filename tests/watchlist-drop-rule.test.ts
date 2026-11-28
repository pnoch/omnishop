import { describe, expect, it } from "vitest";
import {
  evaluateWatchlistDropRule,
  watchlistDropEventId,
  type WatchlistDropRule,
} from "../lib/watchlist-drop-rule";
import type { DistributorListing, PricePoint, Product } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function point(price: number, daysAgo: number, stockStatus: PricePoint["stockStatus"] = "in_stock"): PricePoint {
  return {
    date: new Date(NOW - daysAgo * DAY).toISOString(),
    price,
    currency: "USD",
    stockStatus,
  };
}

function listing(overrides: Partial<DistributorListing> = {}): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 85,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    lastChecked: new Date(NOW).toISOString(),
    priceHistory: [point(100, 1), point(85, 0)],
    ...overrides,
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Router",
    modelNumber: "TEST-1",
    brand: "Test",
    category: "Networking",
    description: "Test product",
    addedAt: new Date(NOW - 10 * DAY).toISOString(),
    isWatched: true,
    listings: [listing()],
    ...overrides,
  };
}

const RULE: WatchlistDropRule = {
  enabled: true,
  percent: 10,
  windowHours: 24,
};

describe("evaluateWatchlistDropRule", () => {
  it("fires when the best in-stock price is the threshold below the window start", () => {
    const triggers = evaluateWatchlistDropRule([product()], RULE, "USD", NOW);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      productId: "p1",
      currentPrice: 85,
      baselinePrice: 100,
      dropPercent: 15,
    });
  });

  it("does not fire below the threshold", () => {
    const products = [
      product({ listings: [listing({ price: 95 })] }),
    ];
    expect(
      evaluateWatchlistDropRule(products, RULE, "USD", NOW),
    ).toHaveLength(0);
  });

  it("skips a baseline that is too old to represent the window", () => {
    const products = [
      product({
        listings: [
          listing({
            priceHistory: [point(100, 3), point(85, 0)],
          }),
        ],
      }),
    ];
    expect(
      evaluateWatchlistDropRule(products, RULE, "USD", NOW),
    ).toHaveLength(0);
  });

  it("uses the 7-day window when selected", () => {
    const products = [
      product({
        listings: [
          listing({ priceHistory: [point(100, 7), point(85, 0)] }),
        ],
      }),
    ];
    expect(
      evaluateWatchlistDropRule(
        products,
        { ...RULE, windowHours: 168 },
        "USD",
        NOW,
      ),
    ).toHaveLength(1);
  });

  it("requires an in-stock current price and ignores out-of-stock history", () => {
    const products = [
      product({
        listings: [
          listing({
            stockStatus: "out_of_stock",
            priceHistory: [point(100, 1), point(60, 0, "out_of_stock")],
          }),
        ],
      }),
    ];
    expect(
      evaluateWatchlistDropRule(products, RULE, "USD", NOW),
    ).toHaveLength(0);
  });

  it("skips acquired and marketplace products", () => {
    const acquired = product({
      acquiredAt: new Date(NOW).toISOString(),
    });
    const marketplace = product({
      marketplace: { platform: "shopee", listingId: "x" } as never,
    });
    expect(
      evaluateWatchlistDropRule([acquired, marketplace], RULE, "USD", NOW),
    ).toHaveLength(0);
  });

  it("does nothing when the rule is disabled", () => {
    expect(
      evaluateWatchlistDropRule(
        [product()],
        { ...RULE, enabled: false },
        "USD",
        NOW,
      ),
    ).toHaveLength(0);
  });
});

describe("watchlistDropEventId", () => {
  it("is stable within a window and changes across windows or rules", () => {
    const trigger = { productId: "p1" };
    const a = watchlistDropEventId(trigger, RULE, NOW);
    expect(watchlistDropEventId(trigger, RULE, NOW + 1_000)).toBe(a);
    expect(watchlistDropEventId(trigger, RULE, NOW + DAY)).not.toBe(a);
    expect(
      watchlistDropEventId(trigger, { ...RULE, percent: 15 }, NOW),
    ).not.toBe(a);
  });
});
