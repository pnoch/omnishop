# UX/UI Refactor Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the highest-impact navigation, density, and data-truth problems in the Expo app and polish Discover/onboarding without changing the brand.

**Architecture:** Reuse the existing screen and card components. Extract a small shared `PageHeader` only where it is used twice; keep Watchlist’s rich product card. Each task is independently shippable and guarded by a source/unit test plus a production screenshot check.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Vitest, Playwright/patchright.

**Spec:** `docs/superpowers/specs/2026-11-17-ux-ui-refactor-design.md`

## Global Constraints

- Expo app only; do not modify `desktop/src` except shared modules if unavoidable.
- Keep the current palette, typography, brand mark, and icon set.
- `ListRow` does not replace the Watchlist `ProductCard`.
- Every screen keeps a visible navigation path: rail, tab bar, or back control.
- A zero count is only rendered after its data source has loaded.
- Product Detail’s badge follows region-filtered visible listings.
- Do not regress 390px or 1440px layouts.
- `pnpm check`, `pnpm lint`, `pnpm test`, desktop tests, and web build must pass.

## Review Focus

- Direct URL vs tab navigation for `/drops`; both must show the same shell.
- Product Detail opened from Watchlist on web at desktop width; a back control must exist.
- Signed-out user on a configured server; label must say Signed out, not Local only.
- Brand-new watchlist with no listings; rows must not say “0 distributors”.
- Product with only back-order listings; header badge must not say In Stock.
- 390px Alerts screen; the segmented control and alert card must not overflow or stack icons vertically.
- 1440px Discover; trending must not leave an orphan card.

---

### Task 1: Remove the duplicate `/drops` route

**Files:**
- Move: `app/drops.tsx` → `components/drops/drops-screen.tsx`
- Modify: `app/(tabs)/drops.tsx`
- Modify: `tests/drops-wiring-guard.test.ts`

**Interfaces:**
- Produces: `DropsScreen({ showBack?: boolean })` from `components/drops/drops-screen.tsx`.

- [x] **Step 1: Move the screen and update the tab route**

Create `components/drops/drops-screen.tsx` with the current `DropsScreen` implementation. Delete `app/drops.tsx`. Change `app/(tabs)/drops.tsx` to import from `@/components/drops/drops-screen`.

- [x] **Step 2: Update the guard test**

Change the test to read `components/drops/drops-screen.tsx` and assert `DropsScreen` exists. Add an assertion that `app/drops.tsx` does not exist.

- [x] **Step 3: Run the test**

Run: `pnpm vitest run tests/drops-wiring-guard.test.ts`
Expected: PASS.

- [x] **Step 4: Verify both routes in the browser**

Open `https://web.omnishop.siamcreations.app/drops` directly, then click the Drops tab from Home. Both must render the tab shell and the same title.

- [x] **Step 5: Commit**

```bash
git add app components tests
git commit -m "fix: remove duplicate drops route"
```

### Task 2: Product Detail back control, stock badge, and image framing

**Files:**
- Modify: `components/product/detail-header.tsx`
- Modify: `components/product/detail-sticky-header.tsx`
- Modify: `components/product/product-info-card.tsx`
- Modify: `app/product/[id].tsx`
- Test: `tests/ux-ui-refactor.test.ts`

**Interfaces:**
- `DetailHeader` gains `onBack: () => void` and `stockStatus: string`.
- `DetailStickyHeader` gains `onBack: () => void`.
- `DetailHeader` renders `StockBadge status={stockStatus}` instead of a constant.
- `ProductInfoCard` image uses `resizeMode="contain"`, an aspect ratio, and a max height.

- [x] **Step 1: Write the failing source test**

Assert that `DetailHeader` contains `onBack`, that the product screen passes `goBackOrHome(router)`, that `StockBadge` receives `stockStatus`, and that the image uses `resizeMode="contain"`.

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts`
Expected: FAIL on the missing back/stock/image assertions.

- [x] **Step 3: Implement the header and badge**

Add a back arrow button at the left of `DetailHeader` and `DetailStickyHeader`. In `ProductDetailScreen`, compute:

```ts
const headerStockStatus = bestInStockListing
  ? "in_stock"
  : visibleListings.some((l) => l.stockStatus === "back_order")
    ? "back_order"
    : visibleListings.length > 0
      ? "out_of_stock"
      : "unknown";
```

Pass `onBack={() => goBackOrHome(router)}` and `stockStatus={headerStockStatus}`.

- [x] **Step 4: Implement the image framing**

Wrap the detail image in a container with `width: "100%"`, `aspectRatio: 16 / 9`, `maxHeight: 360`, and use `resizeMode="contain"`. Keep the existing fade animation.

- [x] **Step 5: Run the test and typecheck**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts && pnpm check`
Expected: PASS.

- [x] **Step 6: Verify at 390px and 1440px**

Open a product from Watchlist in the web app at both widths. Confirm the back control is visible, the badge matches the listing state, and the image is not cropped.

- [x] **Step 7: Commit**

```bash
git add app components tests
git commit -m "fix: product detail navigation, stock badge, image framing"
```

### Task 3: Compact alerts and responsive tabs

**Files:**
- Modify: `components/alerts/alert-card.tsx`
- Modify: `components/alerts/tab-switcher.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Test: `tests/ux-ui-refactor.test.ts`

**Interfaces:**
- Alert actions move to a horizontal bottom row; the switch stays in the header.
- `TabSwitcher` renders counts as badges, not inside the label text.

- [x] **Step 1: Write the failing test**

Assert that `alert-card.tsx` contains a horizontal action row with Edit/Snooze/Delete labels, and that `tab-switcher.tsx` renders a count badge `View` rather than interpolating ` (${counts[tab]})` into the label.

- [x] **Step 2: Implement the compact alert row**

Keep product name, distributor, target, snoozed/triggered state, and switch. Put edit, snooze, and delete in a bordered bottom row with icon + text and `minHeight: 36`. Use `hitSlop` for touch targets.

- [x] **Step 3: Implement tab badges**

Render the label, then a small count badge when `counts[tab] > 0`. Set label font size to 13 and gap to 4 so the control fits at 390px.

- [x] **Step 4: Add Settings bottom padding**

Change the Settings scroll container `paddingBottom` from `24 + insets.bottom` to `96 + insets.bottom`.

- [x] **Step 5: Run tests and verify mobile**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts && pnpm check`
At 390px, confirm the alert card is ≤ 120px, the tab labels stay on one line, and the last Settings row clears the tab bar.

- [x] **Step 6: Commit**

```bash
git add components app tests
git commit -m "fix: compact alerts and responsive tabs"
```

### Task 4: Truthful connection and price states

**Files:**
- Modify: `components/connection-badge.tsx`
- Modify: `components/watchlist/product-card-footer.tsx`
- Modify: `components/home/home-watchlist-preview.tsx`
- Test: `tests/ux-ui-refactor.test.ts`

**Interfaces:**
- `signed-out` badge label becomes `Signed out`.
- Footer and home preview show “No prices yet” when the distributor/listing count is zero.

- [x] **Step 1: Write the failing test**

Assert the connection config maps `"signed-out"` to `"Signed out"` and the two product summaries branch on zero counts.

- [x] **Step 2: Implement the copy and branches**

Change the footer to show `No distributor prices yet` when `distributorCount === 0`. Change the home preview to show `No prices yet` when `(product.listings ?? []).length === 0`.

- [x] **Step 3: Run tests**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add components tests
git commit -m "fix: truthful connection and price states"
```

### Task 5: Watchlist action row density

**Files:**
- Modify: `components/watchlist/watchlist-header.tsx`
- Test: `tests/ux-ui-refactor.test.ts`

**Interfaces:**
- Action labels become `Analysis`, `Refresh`, `Check`.
- The row fits one line at 390px without hiding labels.

- [x] **Step 1: Write the failing test**

Assert the header does not contain `Refresh all` or `Check Now` as visible labels, and still contains the full accessibility labels.

- [x] **Step 2: Implement the label changes**

Keep `accessibilityLabel="Refresh all prices"` and `accessibilityLabel="Check now"`; change visible text to `Refresh` and `Check`. Keep the existing `isCompact` icon-only behavior below 360px.

- [x] **Step 3: Run the test and check at 390px**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts`
Expected: PASS. Confirm the three buttons share one row on the mobile screenshot.

- [x] **Step 4: Commit**

```bash
git add components tests
git commit -m "fix: keep watchlist actions on one mobile row"
```

### Task 6: Discover and onboarding layout polish

**Files:**
- Modify: `components/home/trending-section.tsx`
- Modify: `components/home/available-section.tsx`
- Modify: `components/search/product-image.tsx`
- Modify: onboarding screen(s) under `app/` that render step 1
- Modify: `shared/src/trending.ts`
- Test: `tests/ux-ui-refactor.test.ts`
- Test: `tests/trending.test.ts` (create if absent)

**Interfaces:**
- Trending: 1 column < 900px, 2 columns 900–1099, 3 columns ≥ 1100.
- Available Now: 2 columns ≥ 1100 with `ProductImage`.
- ProductImage: small fallbacks render the icon only, no “No image” text.
- Trending base URL: `window.location.origin` when no env URL is inlined.

- [x] **Step 1: Write the failing tests**

Assert the 3-column threshold and width, that `AvailableRow` renders `ProductImage`, that the small fallback does not render “No image”, and that `getApiBase` uses `window.location.origin` before localhost.

- [x] **Step 2: Implement the Discover changes**

Compute a `columns` count from `useWindowDimensions()`. Set row width to `32%` for 3 columns, `48.5%` for 2, `100%` for 1. Add `ProductImage` to `AvailableRow` and make Available rows a wrapping grid at ≥ 1100.

- [x] **Step 3: Implement the image fallback and trending base**

For `size < 64`, render only the photo icon in the placeholder. In `shared/src/trending.ts`, return `window.location.origin` when `typeof window !== "undefined"` and the origin is not `null`.

- [x] **Step 4: Implement onboarding width**

Constrain the step-1 content to `maxWidth: 760` and use a 2-column product grid at ≥ 900px. Keep the current selection behavior and Continue disabled state.

- [x] **Step 5: Run tests and verify screenshots**

Run: `pnpm vitest run tests/ux-ui-refactor.test.ts tests/trending.test.ts && pnpm check`
Capture Discover at 1440px and onboarding at 1440px; confirm no orphan trending card and no full-width row stretching.

- [x] **Step 6: Commit**

```bash
git add app components shared tests
git commit -m "feat: polish discover and onboarding layouts"
```

### Task 7: Full verification and release checkpoint

- [x] **Step 1: Run project gates**

```bash
pnpm check
pnpm lint
pnpm test
pnpm check:desktop
pnpm --dir desktop test
pnpm build:web
```

Expected: all pass.

- [x] **Step 2: Run production accessibility smoke**

```bash
BASE_URL=https://web.omnishop.siamcreations.app pnpm smoke:a11y
```

Expected: all six routes pass.

- [x] **Step 3: Capture final screenshots**

Home, Watchlist, Alerts, Discover, Product Detail, Onboarding at 390px and 1440px.

- [x] **Step 4: Update CHANGELOG and version**

Add a `5.30.0` entry; bump `package.json`, `app.config.ts`, `desktop/package.json`, `desktop/src-tauri/tauri.conf.json`, `desktop/src-tauri/Cargo.toml`, and `Cargo.lock` in lockstep.

- [x] **Step 5: Commit and deploy**

```bash
git add -A
git commit -m "release: v5.30.0 UX/UI Phase 1"
git push origin main
```

Production deploy and CI must be green before the phase is complete.
