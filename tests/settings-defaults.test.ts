import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/storage/settings";

// A fresh install used to default to "manual", so the welcome screen promised
// restock and price alerts while nothing ran in the background until the user
// found Settings. Daily is the lowest-cost interval that keeps that promise.
describe("default settings", () => {
  it("enables automatic background checks on a new install", () => {
    expect(["hourly", "daily"]).toContain(DEFAULT_SETTINGS.checkInterval);
  });
});
