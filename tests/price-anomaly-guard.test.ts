import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPriceAnomalyGuardForTests,
  guardPriceAgainstHistory,
} from "../lib/price-anomaly-guard";

const history = [100, 105, 98, 102, 99];

describe("guardPriceAgainstHistory", () => {
  beforeEach(() => clearPriceAnomalyGuardForTests());

  it("accepts a normal price", () => {
    expect(guardPriceAgainstHistory("d|m", 95, history)).toEqual({
      accept: true,
    });
  });

  it("holds the first outlier and accepts a close confirmation", () => {
    expect(guardPriceAgainstHistory("d|m", 20, history)).toEqual({
      accept: false,
      reason: "far_below_history",
    });
    expect(guardPriceAgainstHistory("d|m", 21, history)).toEqual({
      accept: true,
    });
  });

  it("keeps holding when the second outlier is a different band", () => {
    expect(guardPriceAgainstHistory("d|m", 20, history).accept).toBe(false);
    expect(guardPriceAgainstHistory("d|m", 28, history).accept).toBe(false);
    // 28 is now the pending band, so 29 confirms it.
    expect(guardPriceAgainstHistory("d|m", 29, history).accept).toBe(true);
  });

  it("drops a pending outlier that is too old", () => {
    const start = 1_000_000;
    expect(
      guardPriceAgainstHistory("d|m", 20, history, start).accept,
    ).toBe(false);
    expect(
      guardPriceAgainstHistory("d|m", 21, history, start + 49 * 3_600_000)
        .accept,
    ).toBe(false);
  });

  it("accepts when there is not enough history to judge", () => {
    expect(guardPriceAgainstHistory("d|m", 5, [100, 100])).toEqual({
      accept: true,
    });
  });

  it("clears a pending outlier after a normal price", () => {
    expect(guardPriceAgainstHistory("d|m", 20, history).accept).toBe(false);
    expect(guardPriceAgainstHistory("d|m", 100, history).accept).toBe(true);
    expect(guardPriceAgainstHistory("d|m", 20, history).accept).toBe(false);
  });

  it("tracks distributors independently", () => {
    expect(guardPriceAgainstHistory("a|m", 20, history).accept).toBe(false);
    expect(guardPriceAgainstHistory("b|m", 21, history).accept).toBe(false);
  });
});
