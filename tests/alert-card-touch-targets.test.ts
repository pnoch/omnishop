import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

// Active, triggered, stock-watch, and reminder cards now use horizontal action
// rows instead of stacked icon columns. Each action keeps a real 44px target.
const COMPACT_ACTION_CARDS = [
  "components/alerts/alert-card.tsx",
  "components/alerts/triggered-alert-card.tsx",
  "components/alerts/stock-watch-card.tsx",
  "components/alerts/reminder-card.tsx",
];

describe("compact alert-card actions use real touch targets", () => {
  it.each(COMPACT_ACTION_CARDS)("%s has 44px actions and no hitSlop", (rel) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    expect(src).toMatch(/minHeight:\s*44/);
    expect(src).not.toMatch(/hitSlop\s*=/);
  });
});

describe("IconActionButton renders a 44x44 target", () => {
  const src = readFileSync(
    join(ROOT, "components/ui/icon-action-button.tsx"),
    "utf8",
  );

  it("asks the shared icon button for a 44px square and no hitSlop", () => {
    expect(src).toMatch(/size=\{44\}/);
    expect(src).not.toMatch(/hitSlop\s*=/);
  });

  it("the shared icon button never expands its target with hitSlop", () => {
    const button = readFileSync(join(ROOT, "components/ui/icon-button.tsx"), "utf8");
    expect(button).not.toMatch(/hitSlop\s*=/);
  });
});

describe("compact alert actions keep real touch targets", () => {
  const src = readFileSync(join(ROOT, "components/alerts/alert-card.tsx"), "utf8");

  it("lays actions out horizontally with 44px height and no hitSlop", () => {
    expect(src).toMatch(/minHeight:\s*44/);
    expect(src).not.toMatch(/hitSlop\s*=/);
    expect(src).toContain('label="Edit"');
    expect(src).toContain('label="Snooze"');
    expect(src).toContain('label="Delete"');
  });
});

// Enabling the digest made the whole card vanish: `digest` needs a snapshot,
// but no snapshot exists until the first digest is actually delivered, and the
// placeholder only covered the `off` case. Verified on device: toggling
// Off -> Daily/Weekly removed the card entirely with no feedback.
describe("stats digest card survives the pre-snapshot window", () => {
  const src = readFileSync(join(ROOT, "app/stats.tsx"), "utf8");

  it("derives a placeholder for both off and enabled-but-pending", () => {
    expect(src).toContain("digestPlaceholder");
    expect(src).toContain('"pending"');
    expect(src).toMatch(/if \(!digestSnapshot\) return "pending"/);
  });

  it("renders the placeholder branch instead of null", () => {
    expect(src).toMatch(/digestPlaceholder \? \(/);
    expect(src).toContain("Digest scheduled");
    expect(src).toContain("Your first digest will appear here once it's sent.");
  });
});

// EditProductSheet was fully implemented but never rendered, so product editing
// was unreachable on mobile (the desktop ProductDetail already wires it up).
describe("mobile product detail exposes product editing", () => {
  const src = readFileSync(join(ROOT, "app/product/[id].tsx"), "utf8");

  it("imports and renders EditProductSheet", () => {
    expect(src).toContain("EditProductSheet");
    expect(src).toMatch(/<EditProductSheet/);
  });

  it("has an edit affordance in the sticky header", () => {
    const header = readFileSync(
      "components/product/detail-sticky-header.tsx",
      "utf8",
    );
    expect(header).toContain('label="Edit product"');
  });

  it("refreshes the screen after a save", () => {
    expect(src).toContain("onSaved");
  });
});

// ActionButtons was superseded by the product-detail section refactor and left
// unreferenced — 257 lines of dead code that still shipped in the web bundle via
// app/product/_components.tsx. Its unique actions (Copy Link, Test Stock Alert,
// manual Refresh) were intentionally dropped; Compare/Share/Set Alert live on in
// the section components. Keep the file deleted and the re-export gone.
describe("dead ActionButtons component stays removed", () => {
  it("no longer exists on disk", () => {
    expect(() =>
      readFileSync(join(ROOT, "components/product/action-buttons.tsx"), "utf8"),
    ).toThrow();
  });

  it("is not re-exported from the product components barrel", () => {
    const barrel = readFileSync(join(ROOT, "app/product/_components.tsx"), "utf8");
    expect(barrel).not.toContain("ActionButtons");
    expect(barrel).not.toContain("action-buttons");
  });
});
