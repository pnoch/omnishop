import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("UX/UI Phase 2A guards", () => {
  it("privacy has a visible back control", async () => {
    const privacy = await read("app/privacy.tsx");
    expect(privacy).toContain("goBackOrHome(router)");
    expect(privacy).toContain('accessibilityLabel="Back"');
  });

  it("triggered alerts use the compact horizontal action row", async () => {
    const card = await read("components/alerts/triggered-alert-card.tsx");
    expect(card).toContain("padding: 10");
    expect(card).toContain("minHeight: 44");
    expect(card).toContain('label="Watch again"');
    expect(card).toContain('label="Delete"');
    expect(card).not.toContain("IconActionButton");
  });

  it("stats explains the in-stock window instead of claiming no history", async () => {
    const card = await read("components/stats/movers-card.tsx");
    expect(card).toContain("No in-stock moves");
    expect(card).toContain("Try 7D or All");
    expect(card).not.toContain("Not enough price history yet.");
  });

  it("home labels the drop window", async () => {
    const card = await read("components/home/feed-card.tsx");
    expect(card).toContain("Biggest drops · 7D");
  });

  it("onboarding steps 2 and 3 share the constrained width", async () => {
    for (const path of [
      "components/onboarding/concierge-step-region.tsx",
      "components/onboarding/concierge-step-notifications.tsx",
      "components/onboarding/concierge-step-summary.tsx",
    ]) {
      const step = await read(path);
      expect(step).toContain("maxWidth: 640");
      expect(step).toContain('width: "100%"');
    }
  });
});
