import { describe, expect, it } from "vitest";
import {
  alertPercentLabel,
  bestAlertBaseline,
  percentTargetPrice,
} from "../lib/alert-percent";
import type { DistributorListing } from "../lib/types";

function listing(overrides: Partial<DistributorListing>): DistributorListing {
  return {
    distributorId: "d1",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    lastChecked: "2026-11-28T00:00:00.000Z",
    priceHistory: [],
    ...overrides,
  };
}

describe("percentTargetPrice", () => {
  it("computes a rounded target below the baseline", () => {
    expect(percentTargetPrice(451.09, 10)).toBe(405.98);
    expect(percentTargetPrice(100, 5)).toBe(95);
    expect(percentTargetPrice(100, 15)).toBe(85);
  });

  it("rejects invalid baselines and percentages", () => {
    expect(percentTargetPrice(0, 10)).toBeNull();
    expect(percentTargetPrice(100, 0)).toBeNull();
    expect(percentTargetPrice(100, 100)).toBeNull();
    expect(percentTargetPrice(-5, 10)).toBeNull();
  });
});

describe("bestAlertBaseline", () => {
  const listings = [
    listing({ distributorId: "a", price: 120 }),
    listing({ distributorId: "b", price: 80 }),
    listing({ distributorId: "b", price: 50, stockStatus: "out_of_stock" }),
  ];

  it("uses the cheapest in-stock listing in the alert currency", () => {
    expect(bestAlertBaseline(listings, null, "USD")).toBe(80);
    expect(bestAlertBaseline(listings, "a", "USD")).toBe(120);
    expect(bestAlertBaseline(listings, "b", "USD")).toBe(80);
  });

  it("returns null without an in-stock listing or a known currency", () => {
    expect(
      bestAlertBaseline(
        [listing({ stockStatus: "out_of_stock" })],
        null,
        "USD",
      ),
    ).toBeNull();
    expect(bestAlertBaseline(listings, null, "ZZZ")).toBeNull();
  });
});

describe("alertPercentLabel", () => {
  it("describes a percentage alert with its baseline", () => {
    expect(
      alertPercentLabel({
        dropPercent: 10,
        baselinePrice: 451.09,
        currency: "USD",
      }),
    ).toBe("10% below $451.09");
  });

  it("returns null for absolute alerts", () => {
    expect(
      alertPercentLabel({ baselinePrice: 451.09, currency: "USD" }),
    ).toBeNull();
  });
});
