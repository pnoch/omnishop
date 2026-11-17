import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(path, "utf8");

describe("UX/UI Phase 1 guards", () => {
  it("product detail has a back control and an honest stock badge", async () => {
    const header = await read("components/product/detail-header.tsx");
    const sticky = await read("components/product/detail-sticky-header.tsx");
    const screen = await read("app/product/[id].tsx");

    expect(header).toContain("onBack");
    expect(header).toContain("stockStatus");
    expect(sticky).toContain("onBack");
    expect(screen).toContain("goBackOrHome(router)");
    expect(screen).toContain("headerStockStatus");
  });

  it("product detail image is contained instead of cropped", async () => {
    const card = await read("components/product/product-info-card.tsx");
    expect(card).toContain('resizeMode="contain"');
    expect(card).toContain("aspectRatio: 16 / 9");
  });

  it("alerts are compact rows with horizontal actions", async () => {
    const card = await read("components/alerts/alert-card.tsx");
    expect(card).toContain('label="Edit"');
    expect(card).toContain('label="Snooze"');
    expect(card).toContain('label="Delete"');
    expect(card).toContain("padding: 12");
    expect(card).not.toContain("IconActionButton");
  });

  it("alert tabs use count badges instead of parenthetical labels", async () => {
    const tabs = await read("components/alerts/tab-switcher.tsx");
    expect(tabs).toContain("{counts[tab]}");
    expect(tabs).not.toContain("` (${counts[tab]})`");
  });

  it("settings clears the mobile tab bar", async () => {
    const settings = await read("app/(tabs)/settings.tsx");
    expect(settings).toContain("paddingBottom: 96 + insets.bottom");
  });

  it("signed-out users are not labelled local-only", async () => {
    const badge = await read("components/connection-badge.tsx");
    expect(badge).toContain('"signed-out": { label: "Signed out"');
    expect(badge).toContain('local: { label: "Local only"');
  });

  it("empty price states do not claim zero distributors", async () => {
    const footer = await read("components/watchlist/product-card-footer.tsx");
    const preview = await read("components/home/home-watchlist-preview.tsx");
    expect(footer).toContain("No distributor prices yet");
    expect(preview).toContain("No prices yet");
  });
});
