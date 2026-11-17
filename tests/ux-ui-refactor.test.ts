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
    expect(screen).toContain("deriveHeaderStockStatus(visibleListings)");
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
    expect(card).toContain("padding: 10");
    expect(card).toContain("minHeight: 44");
    expect(card).not.toContain("IconActionButton");
  });

  it("alert tabs use count badges instead of parenthetical labels", async () => {
    const tabs = await read("components/alerts/tab-switcher.tsx");
    expect(tabs).toContain("{counts[tab]}");
    expect(tabs).not.toContain("` (${counts[tab]})`");
    expect(tabs).toContain("width < 430");
    expect(tabs).toContain("!hideIcons &&");
  });

  it("settings clears the mobile tab bar", async () => {
    const settings = await read("app/(tabs)/settings.tsx");
    expect(settings).toContain("paddingBottom: 96 + insets.bottom");
  });

  it("signed-out users are not labelled local-only", async () => {
    const badge = await read("components/connection-badge.tsx");
    const section = await read("components/settings/connection-section.tsx");
    expect(badge).toContain('"signed-out": { label: "Signed out"');
    expect(badge).toContain('local: { label: "Local only"');
    expect(section).toContain("Signed out — sign in to sync");
    expect(section).not.toContain("Local only — sign in to sync");
  });

  it("empty price states do not claim zero distributors", async () => {
    const footer = await read("components/watchlist/product-card-footer.tsx");
    const preview = await read("components/home/home-watchlist-preview.tsx");
    expect(footer).toContain("No distributor prices yet");
    expect(preview).toContain("No prices yet");
  });

  it("watchlist actions keep one mobile row without losing full labels", async () => {
    const header = await read("components/watchlist/watchlist-header.tsx");
    expect(header).toContain("Refresh all prices");
    expect(header).toContain("Check now");
    expect(header).toMatch(/>\s*Refresh\s*</);
    expect(header).toContain('"Check"}');
    expect(header).not.toMatch(/>\s*Refresh all\s*</);
    expect(header).not.toContain("Check Now");
  });

  it("discover uses a 3-column trending grid and 2-column available grid on wide screens", async () => {
    const trending = await read("components/home/trending-section.tsx");
    const available = await read("components/home/available-section.tsx");
    expect(trending).toContain("width >= 1100");
    expect(trending).toContain('columns === 3 ? "32.5%"');
    expect(available).toContain('width >= 1100');
    expect(available).toContain('"49.3%"');
    expect(available).toContain("ProductImage");
  });

  it("small image placeholders are icon-only", async () => {
    const image = await read("components/search/product-image.tsx");
    expect(image).toContain("size >= 64 &&");
  });

  it("onboarding step 1 is constrained and two-column on desktop", async () => {
    const step = await read("components/onboarding/concierge-step-products.tsx");
    expect(step).toContain("maxWidth: 760");
    expect(step).toContain("numColumns={columns}");
    expect(step).toContain("width >= 900");
    expect(step).toContain('width: columns > 1 ? "48.5%" : "100%"');
    expect(step).toContain("flexGrow: 0");
  });

  it("onboarding shows a visible progress bar", async () => {
    const screen = await read("components/onboarding/concierge-screen.tsx");
    expect(screen).toContain('accessibilityRole="progressbar"');
    expect(screen).toContain("step + 1) / 3");
  });

  it("onboarding starts with a value-prop welcome before product selection", async () => {
    const screen = await read("components/onboarding/concierge-screen.tsx");
    const welcome = await read("components/onboarding/concierge-welcome.tsx");
    expect(screen).toContain("showWelcome");
    expect(screen).toContain("ConciergeWelcome");
    expect(welcome).toContain("Pick products to track");
    expect(welcome).toContain("Explore first");
    expect(welcome).toContain("Find it. Price it. Get alerted.");
  });

  it("keeps the welcome reachable after Explore first", async () => {
    const route = await read("app/welcome.tsx");
    const home = await read("app/(tabs)/index.tsx");
    const about = await read("components/settings/about-section.tsx");
    expect(route).toContain("ConciergeScreen");
    expect(home).toContain("Pick popular products");
    expect(home).toContain('router.push("/welcome")');
    expect(about).toContain("Show welcome again");
    expect(about).toContain('router.push("/welcome")');
  });
});
