# OmniShop UX/UI refactor — design

Date: 2026-11-17
Status: proposed (option 2, staged)

## Intent

Make OmniShop feel like one application instead of a collection of screens.
The review found a coherent visual language on the tab screens, but navigation,
page structure, list density, and status copy break down on standalone screens
and at mobile widths. This refactor introduces a small set of shared layout and
list primitives, then migrates screens in phases so the app keeps shipping while
the structure improves.

## Builder-check decisions

These were open in the first draft; the calls are:

1. **Scope is the Expo app (web + mobile).** The separate Tauri app in
   `desktop/src` already has a persistent sidebar and a product back control;
   it is not part of this refactor. Shared-code fixes must not break its build.
2. **`ListRow` is a compact-row shell, not a replacement for Watchlist’s
   `ProductCard`.** Watchlist keeps its rich product card and only adopts
   `PageScaffold`/`PageHeader`/`StatGrid`. `ListRow` is for Available Now,
   alerts, reminders, and drops.
3. **“Every screen” means every Expo Router screen.** Phase 2 includes
   `search`, `compare`, `available`, `you`, `distributor-analysis`, `privacy`,
   `restock-watches`, `sourcing`, `build-order`, `connected-marketplaces`,
   `diagnostics`, and the auth screens. Privacy gets a back control.
4. **Product Detail’s header badge follows the region-filtered visible
   listings.** If a visible in-stock listing exists, show In Stock; else if a
   visible listing is back-order, show Back Order; else if visible listings
   exist, show Out of Stock; else No data. A global in-stock listing hidden by
   the region filter must not produce a false In Stock badge. The `available`
   screen is exempt because it only receives in-stock rows.
5. **`StatGrid` applies to Home’s four tiles only.** The Stats page keeps its
   analytical card stack; Phase 2 may give that stack a wide-screen layout, but
   it is not forced into `StatGrid`.

## Goals

- Keep navigation visible (desktop rail, mobile tab bar) or provide an obvious
  back control on every screen, including product detail.
- One page-header pattern: back, title, subtitle, actions, optional sticky mode.
- One page-body pattern: safe area, max width, gutters, bottom inset.
- One card/list-row pattern for products, alerts, reminders, and stats.
- One segmented-control pattern that never wraps on a 390px screen.
- Truthful loading and status copy: no “0 distributors” while prices are still
  loading, no “In stock” badge when the listing is out of stock, and no “Local
  only” label for a signed-out user on a connected server.
- Consistent responsive grids on Discover, onboarding, stats, and rates.
- Keep the current colors, typography, brand mark, and icon set. This is a
  structure and density pass, not a rebrand.

## Non-goals

- New brand identity, palette, or font family.
- New backend features or data-model changes.
- Rewriting every screen in one release. The migration is phased.
- Replacing Expo Router’s tab navigator with a custom router.

## Anti-goals

- A big-bang refactor that leaves the app half-migrated for days.
- Screens that look consistent only at 1440px.
- Hiding real data problems behind prettier empty states.

## What the review found

1. `app/drops.tsx` and `app/(tabs)/drops.tsx` both resolve to `/drops`. Direct
   loads use the root screen (no shell); tab navigation uses the tab screen.
2. Product Detail has no back control and no shell. In the desktop app there is
   no browser chrome, so a product opened from Watchlist traps the user.
3. `DetailHeader` hardcodes `StockBadge status="in_stock"`, producing a green
   “In Stock” banner next to “In Stock 0”.
4. `ConnectionBadge` uses “Local only” for the signed-out state even when the
   server is configured and reachable.
5. Product cards show “0 distributors” while listing data is still loading.
6. Alerts render as tall cards with a vertical stack of 44px icon buttons. The
   mobile segmented control wraps “Reminders (5)” onto two lines.
7. Watchlist filters and actions consume most of the first mobile screen.
8. Discover’s trending grid is two columns at 1440px, leaving an orphan card;
   Available Now rows have no imagery; the no-image placeholder is harsh.
9. Onboarding is full-width at 1440px, with very long rows and no visual
   progress beyond “Step 1 of 3”.
10. Trending on web falls back to `http://localhost:3000` when no build-time API
    URL exists, then the CSP blocks the request.

## Approach chosen

Option 2: shared primitives plus a staged migration.

Create the primitives first, migrate the highest-traffic screens, then move the
remaining screens. Each phase is shippable and independently verifiable.

### Primitives

- `PageScaffold`
  - Safe-area wrapper, max-width content, responsive gutters, bottom inset for
    the mobile tab bar, optional scroll container.
  - Used inside the existing tab navigator and by standalone routes.

- `PageHeader`
  - `back` action, title, subtitle, optional actions, optional sticky/compact
    mode.
  - Desktop: title and actions align in one row.
  - Mobile: title can wrap; actions stay on one line or move to an overflow menu.

- `DesktopNavRail` (extracted from `app/(tabs)/_layout.tsx`)
  - Shared visual rail for standalone desktop screens so they match tab screens.
  - The Expo Router tab navigator remains the source of truth for tab routes.

- `SectionCard`
  - Existing `Card` plus an optional title, description, and action.
  - Replaces one-off section headers in Home, Watchlist, Alerts, Stats, Health.

- `StatGrid`
  - 2 columns on narrow screens, 4 on wide.
  - Handles long labels without uneven row heights.

- `ListRow`
  - Optional thumbnail, title, subtitle, meta line, trailing value/action.
  - Used for watchlist rows, available-now rows, alerts, reminders, and drops.

- `SegmentedTabs`
  - Label plus count badge rendered as a separate element, not inside the label.
  - Horizontal scroll fallback if labels still exceed the width.

- `EmptyState` (existing `EmptyStateView` extended)
  - Consistent icon, title, body, primary action, and optional secondary action.

### Phase 1 — shell, navigation, and high-traffic screens

Screens: Home, Watchlist, Product Detail, Alerts, Settings, Discover.

- Remove the duplicate root `/drops` route. Move `DropsScreen` into
  `components/drops/drops-screen.tsx`; keep `(tabs)/drops.tsx` as the only route.
- Add the shared `PageHeader` with a back control to Product Detail and its
  sticky header.
- Add the `DesktopNavRail` to standalone desktop screens that currently have no
  navigation (product detail; later phases for stats/health/etc.).
- Migrate Home and Watchlist to `PageScaffold`, `StatGrid`, and `ListRow`.
- Compact the alert card: product + target on the left, current status and
  actions on the right; actions become a horizontal icon row on desktop and a
  compact action row under the content on mobile. Target height: ≤ 120px.
- Replace the alert tab labels with `SegmentedTabs`; counts become badges.
- Tighten Watchlist: actions fit one row on mobile; search/sort/group collapse
  into a single toolbar with filters behind one button.
- Change the signed-out connection label from “Local only” to “Signed out”
  (or “Guest”); keep “Local only” for an unconfigured server.
- Derive the Product Detail stock badge from the best listing instead of
  hard-coding `in_stock`.
- Show “Checking prices…” / “No prices yet” instead of “0 distributors” while
  listing data is absent or loading.
- Discover: 3-column trending grid at ≥ 1100px, 2-column Available Now at
  ≥ 1100px, thumbnails on Available Now rows, and a branded image fallback.
- Fix the web trending base URL to use `window.location.origin`.

### Phase 2 — remaining screens

Screens: Drops, Stats, Health, Rates, Sourcing, Build Order, Restock Watches,
Connected Marketplaces, Diagnostics, Shared links.

- Adopt `PageScaffold` and `PageHeader`.
- Add the desktop rail where the screen is reachable from the rail.
- Apply `StatGrid` and `ListRow`.
- Align Stats movers/drops with the same server price history used by Home’s
  Biggest Drops, or label the cards explicitly as local-device data.
- Remove duplicate empty-state CTAs (Health has two “Test All Distributors”
  buttons).
- Replace cryptic metric strings such as `0·1·1` with a labeled distribution.

### Phase 3 — onboarding and polish

- Constrain onboarding to ~760px on desktop.
- Use a 2-column product picker at ≥ 900px; keep one column on mobile.
- Add a visible 3-step progress bar.
- Use the branded image fallback everywhere.
- Normalize bottom padding so no row sits under the tab bar.
- Add hover/pressed states and tooltips for icon-only desktop actions.

## Data and state rules

- A zero count is only rendered after the relevant data source has loaded.
- “Signed out” means the server is configured but there is no session.
- “Local only” means no server URL is configured.
- Stock badges come from the selected listing’s `stockStatus`, never a constant.
- Empty states state what is missing and offer exactly one primary action.

## Responsive rules

- Breakpoints: 390 (phone), 768 (tablet), 1100 (desktop content grid).
- Desktop rail appears at ≥ 960, matching the existing tab layout.
- Cards and list rows never require horizontal scrolling.
- Long labels wrap or truncate; they never force a control to wrap.

## Risks and mitigations

- Broad test churn: migrate in phases; keep source-level guard tests updated.
- RN Web vs native differences: use existing `Platform.OS` and
  `useWindowDimensions` patterns; do not introduce CSS-only behavior.
- Visual regressions: screenshot Home, Watchlist, Product Detail, Alerts,
  Discover, and Settings at 390 and 1440 after each phase.
- Route changes: verify direct URLs and tab navigation for `/drops`.
- Desktop shell: do not replace Expo Router tabs; extract the rail and reuse it.

## Acceptance criteria

- Every screen has either the desktop rail, the mobile tab bar, or a visible back
  control.
- `/drops` resolves to one screen with the same shell from a direct URL and from
  the tab/rail.
- An alert card is ≤ 120px tall on mobile and desktop.
- The mobile alert segmented control stays on one line at 390px.
- No product card shows “0 distributors” while prices are loading.
- No “In Stock” badge appears when the selected listing is out of stock.
- Signed-out users on a configured server see “Signed out”, not “Local only”.
- Discover uses 3 trending columns and 2 Available Now columns at 1440px.
- Onboarding content is max-width 760px and 2 columns at ≥ 900px.
- `pnpm check`, `pnpm lint`, `pnpm test`, desktop tests, and the web build pass.
- Production accessibility smoke still passes at 390 and 1440.

## Rollout

Phase 1 ships as one release after review. Phase 2 and Phase 3 are separate
releases. Each phase updates `CHANGELOG.md` and the version in lockstep.
