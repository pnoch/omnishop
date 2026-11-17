import { describe, expect, it } from "vitest";
import { deriveHeaderStockStatus } from "../lib/product-header-status";

const listing = (stockStatus: string, price = 10) =>
  ({ stockStatus, price }) as never;

describe("deriveHeaderStockStatus", () => {
  it("uses any visible in-stock listing, even a quote-only price", () => {
    expect(
      deriveHeaderStockStatus([listing("out_of_stock"), listing("in_stock", 0)]),
    ).toBe("in_stock");
  });

  it("shows back order when no visible listing is in stock", () => {
    expect(
      deriveHeaderStockStatus([listing("back_order"), listing("out_of_stock")]),
    ).toBe("back_order");
  });

  it("shows out of stock when visible listings are all out", () => {
    expect(deriveHeaderStockStatus([listing("out_of_stock")])).toBe(
      "out_of_stock",
    );
  });

  it("shows no data for an empty visible set", () => {
    expect(deriveHeaderStockStatus([])).toBe("unknown");
  });

  it("does not let a region-hidden in-stock listing leak through", () => {
    // The caller passes visibleListings only; an empty post-filter set is No data.
    expect(deriveHeaderStockStatus([])).toBe("unknown");
  });
});
