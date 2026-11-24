# Changelog

Notable changes to OmniShop. The version is kept in lockstep across
`package.json`, `app.config.ts`, `desktop/package.json`,
`desktop/src-tauri/tauri.conf.json` and `desktop/src-tauri/Cargo.toml`.

## [5.32.44] - 2026-11-24

### Added

- Browser gates in CI: `pnpm audit:layout` checks every route at 320/390/768/1440
  for off-screen or clipped controls, tap targets below 40 px, duplicate
  accessible names, and horizontal overflow; `pnpm audit:contrast` checks WCAG
  AA text contrast in light and dark mode. The audits seed a product, alert,
  and reminder so card-heavy screens render.

### Fixed

- Regressions the new gates caught: Home’s empty-state “Add your first product”
  (unique name, 44 px), watchlist header actions, compare header/sort/refresh
  actions, the health detail back link, search filter/sort chips (44 px plus
  contextual names), stock/scarcity/price-change/status text colors, the alert
  tab badge, and drop-calendar cells/country codes (including the off-screen
  share card).

## [5.32.43] - 2026-11-24

### Fixed

- The Manual Add sheet had no scroll container: on a short screen (320×568) the
  “Fetch from URL” action sat below the viewport and could not be reached. The
  step content now scrolls inside the 85% sheet, and the action is reachable at
  568 px height and in landscape (844×390).
- A second sweep of vertical occlusion and text clipping — routes at 320/390/768,
  all main sheets at 320/390 and 844×390, tab-bar/FAB overlap, and clipped Text
  nodes — found no other unreachable controls.

## [5.32.42] - 2026-11-24

### Fixed

- Watchlist filters: the Min/Max price inputs overflowed the viewport at 320 and
  390 px because the filter row could not wrap (the inputs started at x≈345).
  The row wraps and the price group takes its own line on phones; the inputs
  stay inside 320 / 390 / 768 px.
- App-wide reflow audit: 25 routes at 320 / 390 / 768 px, 11 sheets and modals
  at 320 / 390 px, and the scrolled product/compare headers — no clipped
  controls or horizontal overflow remain.

## [5.32.41] - 2026-11-24

### Fixed

- The Home header’s connection badge, profile/settings, and add buttons were
  clipped off-screen on phones: the single row needs about 470 px, wider than
  every 320–430 px viewport. Below 560 px the action row now sits under the
  greeting, so all three controls are reachable.
- A 320 px reflow audit (WCAG 1.4.10) across ten routes reports no horizontal
  overflow and no controls outside the viewport.

### Docs

- `AGENTS.md` no longer pins a stale version; it points at `package.json` and
  `CHANGELOG.md`.

## [5.32.40] - 2026-11-24

### Accessibility

- The undo snackbar is a polite live region, so “Removed …” and Undo are
  announced, and Undo is a 44 px target.
- Connection status changes and “Finding prices…” progress are announced to
  screen readers instead of only changing visually.

### Verification

- `pnpm verify` passes end to end: typecheck, lint, 4,329 tests, desktop checks
  and tests, Rust tests, and the Android JS bundle.

## [5.32.39] - 2026-11-24

### Accessibility

- The connection-status label uses the readable success/warning/error variant,
  so the production-only “Offline” state (3.76:1) now meets WCAG AA. The status
  dot keeps the brand color.

## [5.32.38] - 2026-11-24

### Accessibility

- Added scheme-aware foreground variants (`primaryText`, `successText`,
  `warningText`, `errorText`) and slightly darkened the dark-mode primary fill.
  Foreground uses that failed WCAG AA now pass: light-mode success/amber/red text
  was 2.1–3.8:1 on white, and dark-mode white-on-blue buttons were 4.1:1.
- The active tab label/icon uses the readable primary variant in dark mode.
- A browser contrast audit of Home, Watchlist, Alerts, Settings, and Rates in
  light and dark mode reports zero failures (4.5:1 normal text, 3:1 large text).

## [5.32.37] - 2026-11-24

### Fixed

- Remaining screens now meet the 44 px target: Statistics movers windows,
  digest and basket-alert controls, Health filters, Sourcing/Build Order “Open
  settings”, Drops share/window/sort chips, Connected Marketplaces actions, and
  empty-state secondary actions.
- Browser audit of the remaining routes (Stats, Health, Sourcing, Build Order,
  Drops, Available, Diagnostics, Connected Marketplaces, Privacy, Restock
  Watches, You, Distributor Analysis, reset/verify screens) at 390 px and
  1440 px: no control below 40 px, no duplicate accessible names, no horizontal
  overflow.

## [5.32.36] - 2026-11-24

### Fixed

- Two targets that only appear with live data: Discover’s “See all”
  available-products link and the Settings/You “Sign in” buttons are now 44 px.

## [5.32.35] - 2026-11-24

### Fixed

- Tap targets across Home, Watchlist, Alerts, Discover, Settings, and Rates are
  now at least 44 px: alert tabs, sort/group chips, the product-title control,
  the Buy pill, “See all price drops”, the connection badge, search
  manual/bulk-import icons, Discover add buttons, settings action buttons and
  pickers, rate range chips, and the site-session buttons.
- Discover’s three identical “Add to watchlist” controls now name their
  product, and settings pickers say which setting they change (“Select Off for
  …”), so screen readers no longer hear duplicates.
- Browser audit of all six routes at 390 px and 1440 px: no control below
  40 px, no duplicate accessible names, no horizontal overflow.

## [5.32.34] - 2026-11-24

### Fixed

- The remaining text-link actions on the watchlist and product detail
  (“No prices — Find”, “Find more prices”) now have 44 px targets too. A
  production audit of the product detail screen now reports no interactive
  control below 40 px and no duplicate accessible names.

## [5.32.33] - 2026-11-24

### Fixed

- Product detail tap targets: the sticky header actions, back control,
  watch/acquired chips, Buy now, “Set alert at…”, Visit store, Add price alert,
  Remind me, note edit, and the per-distributor “+” target buttons are all at
  least 44 px (the “+” buttons were 26 px).
- Price-chart and distributor-site buttons include the distributor name
  (“Open price chart for MikroTik Store EU”), so screen readers no longer hear
  three identical controls; the note row is announced as “Edit note content”.
- The sticky header mounts only after a small scroll, so its transparent copy
  of Back/Edit/Share/Export is no longer in the accessibility tree or tab order
  at the top of the page.

## [5.32.32] - 2026-11-23

### Fixed

- A closed watchlist row no longer keeps its swipe actions mounted. The hidden
  buttons stayed in the accessibility tree and keyboard tab order, so screen
  readers announced and keyboard users tabbed into invisible
  Alert/Want/Remove controls alongside the visible footer actions. The actions
  now mount on drag or open and unmount after the close animation.

## [5.32.31] - 2026-11-23

### Changed

- The tag manager shows how many products use each tag (“Used by N products” or
  “Not used yet”), and the delete confirmation names that count before removing
  the tag. Counts reload whenever the sheet opens, so a shared tag is not
  deleted blindly.
- Deleting a tag still removes it from every product and stamps `tagsUpdatedAt`
  so the tag-LWW sync cannot resurrect it on another device.

## [5.32.30] - 2026-11-23

### Changed

- Reminder and reschedule sheets have one-tap presets — Tomorrow, In 1 week,
  In 1 month — so the common cases no longer need the calendar. The presets are
  a radio group, show which one matches the selected date, are clamped to the
  sheet’s minimum date, and expose `aria-checked` on web.
- The calendar remains available for any other date.

## [5.32.29] - 2026-11-23

### Changed

- Web alerts and confirmations are now themed in-app dialogs instead of
  browser `alert`, `confirm`, and numbered `prompt` popups. Destructive actions
  (remove product, remove selected products, delete tag) use the same dialog on
  every platform, with Cancel and a red Remove/Delete.
- The dialog queues overlapping alerts, focuses the cancel action, closes on
  Escape or a backdrop press, and is announced as an alert. Native keeps the
  system alert.

## [5.32.28] - 2026-11-23

### Changed

- Snoozing a price alert now opens an in-app sheet with 1/3/7/30-day choices
  (each showing the date it ends) plus a “Wake now” action when the alert is
  already snoozed. The web app previously asked for a number of days with
  `window.prompt`; native used a five-button system alert that had to be split
  to fit Android’s three-button limit.
- The sheet names the product and its current snooze date, and the alert card
  refreshes immediately after a choice. The snooze handler no longer branches
  on platform.

## [5.32.27] - 2026-11-23

### Changed

- Watchlist rows show a price-alert action in the footer (outline bell, filled
  when an alert exists), so setting or managing an alert no longer requires
  discovering the swipe gesture.
- Footer actions (alert, acquired, tags, delete) use the shared icon button, so
  they gain the hover/pressed tint and desktop tooltip. The distributor/updated
  text is now a two-line block, keeping four 44 px actions inside a 390 px card.
- The shared icon button no longer sets `hitSlop`; its 44 px box is the target,
  so adjacent actions in dense rows cannot overlap and swallow taps.

## [5.32.26] - 2026-11-23

### Changed

- Icon-only desktop actions now share one `IconButton` with a hover tint, a
  pressed tint, a 44 px default target, and a browser tooltip: page headers, product
  detail (sticky and inline), compare, statistics, search/drops/you back
  actions, diagnostics refresh, edit/close controls, and the note edit action.
- eBay search results without a photo show the branded product-image
  placeholder instead of nothing.
- Reduced-motion detection is one hook again (`useReduceMotion`); it now also
  honours the web `prefers-reduced-motion` setting. The duplicate hook added in
  5.32.24 is gone.

## [5.32.25] - 2026-11-23

### Performance

- The push-token module no longer imports `expo-device` (and its
  `ua-parser-js` dependency) on web: the real-device check is platform-split,
  so the shared chunk drops another 25 KB uncompressed.
- Measured locally on slow 4G with 4x CPU throttling, 5.32.23 → 5.32.25 cut
  DOMContentLoaded from 4.44 s to 3.46 s and transferred JS from 817 KB to
  614 KB.

## [5.32.24] - 2026-11-23

### Performance

- The watchlist swipe row now uses React Native's `PanResponder` and
  `Animated` instead of `ReanimatedSwipeable`, and reduced-motion detection has
  its own hook. The gesture-handler root is platform-split, so the web build no
  longer ships `react-native-reanimated` or `react-native-gesture-handler`.
  The shared chunk fell from 2.08 MB to 1.13 MB (504 KB → 310 KB gzip).
- Swipe-to-reveal, drag-to-close, tap-to-close, remove, and undo behave as
  before; a new test covers the swipe thresholds and the action wiring.

## [5.32.23] - 2026-11-23

### Performance

- The initial web JavaScript shrank by about 1.0 MB uncompressed. The shared
  chunk fell from 3.08 MB to 2.08 MB (740 KB → 504 KB gzip) and now excludes
  packages the browser never executes:
  - Marketplace connection validation uses hand-written validators instead of
    zod.
  - Distributor ids and origins live in lightweight metadata modules, so
    discovery, health, and settings no longer pull every parser (and cheerio).
  - The web build resolves stubs for the distributor registry and the
    Facebook/Shopee HTML parsers; native keeps the real parsers.
  - The launch price check, background task registration, missing-listing
    rediscovery, and the Facebook results section load after the first render.

## [5.32.22] - 2026-11-23

### Performance

- The web build now ships an 8.6 KB subset of MaterialIcons instead of the
  348 KB full font, covering the 81 glyphs the app maps. The full font is no
  longer in the web export. Regenerate the subset with
  `scripts/subset-material-icons.py` after adding a mapping.

## [5.32.21] - 2026-11-23

### Performance

- The server compresses HTML, JS, CSS, and JSON with brotli or gzip. The entry
  bundle drops from about 1.1 MB to 285 KB over the wire.
- The SPA serves an inline branded boot shell, so first paint no longer waits for
  the JS bundle, and repeat navigation paints immediately.
- In a throttled local run using the same profile as the baseline, welcome first
  paint fell from about 7.0 s to 1.8 s on slow 4G and from 3.3 s to 0.4 s on
  normal 4G.

## [5.32.20] - 2026-11-23

### Added

- Alerts and Home show a banner when notification permission is denied and at
  least one alert, reminder, or stock watch is saved. It links to system settings
  and re-checks when the app returns to the foreground, so alerts that stop
  silently are explained.

### Changed

- The accessibility smoke covers 11 routes at desktop and mobile viewports. It no
  longer fails a page whose only focusable control leaves the second Tab in
  browser chrome.

## [5.32.19] - 2026-11-23

### Security

- Price refreshes compare each new price with the trusted history median. A
  single outlier is held and is only written after a second reading within 10%
  confirms it, so a care plan, mount, or sibling model cannot overwrite a good
  price. Applied to the server cache/history and to local-only client refreshes.

## [5.32.18] - 2026-11-23

### Security

- Backup import caps the file at 10 MB and each collection at 5,000 items, and
  drops rows missing required fields (product name, alert target price, reminder
  date). A crafted or accidentally huge backup can no longer freeze the app or
  import unusable entries.

## [5.32.17] - 2026-11-22

### Security

- Product-image resolution rejects redirects that leave distributor hosts and
  `og:image` targets on private or loopback hosts, closing an SSRF path from a
  compromised distributor page. Cached image URLs are checked before a thumbnail
  fetch as well.

## [5.32.16] - 2026-11-22

### Security

- The BYO-LLM API key is stored in the OS keychain on iOS and Android instead of
  plaintext AsyncStorage settings. Existing plaintext keys migrate on first read,
  keychain writes are cached to avoid a read on every settings access, and a
  failed keychain write keeps the legacy copy rather than losing the key. Web
  keeps the existing storage because SecureStore is unavailable there. The key
  remains excluded from sync and backups.

## [5.32.15] - 2026-11-22

### Security

- AI discovery keeps the user query in the user message rather than embedding it
  in the system prompt, so query text cannot override the JSON output contract.

### Changed

- AI price insights send the last 14 points per distributor plus a
  points/min/max/average summary instead of the full price history. This cuts
  token cost and keeps small BYO models inside their context window.

## [5.32.14] - 2026-11-22

### Changed

- A fresh install now defaults to a **daily** background check instead of
  **manual**, so the welcome screen's restock and price-alert promise holds
  without a trip to Settings. Existing saved values are untouched, and manual
  remains an option.

## [5.32.13] - 2026-11-22

### Fixed

- The eBay Retry button bypasses the blocked-browser cooldown, so a manual retry
  can actually reach eBay instead of returning the cached block.

### Added

- When eBay search is blocked, the card links to the same keyword search on
  ebay.com.

## [5.32.12] - 2026-11-22

### Fixed

- After eBay blocks the public search page, the server waits five minutes before
  rendering it again instead of paying the 20-second attempt on every query.

## [5.32.11] - 2026-11-22

### Fixed

- Sandbox eBay results are no longer discarded. Sandbox `itemWebUrl` values use
  `http://www.sandbox.ebay.com`, which the mapper rejected because it only
  accepted production https links. Sandbox mode also no longer falls back to the
  production browser page, and a rejected keyset reports `credentials` instead
  of blaming the network.

## [5.32.10] - 2026-11-22

### Changed

- eBay search can use a sandbox keyset. Set `EBAY_ENVIRONMENT=sandbox` so the
  OAuth and Browse calls go to `api.sandbox.ebay.com`; production remains the
  default. Previously the hosts were hardcoded, so a sandbox keyset could not be
  tested at all.

## [5.32.9] - 2026-11-22

### Changed

- Settings has the shared page header, so the gear route has a visible 44 dp back
  control. `PageHeader` now renders a real level-1 heading on web, keeping one H1
  per screen.
- A product being added shows "Checking distributor prices…" while the
  distributor scrape runs, instead of only a spinner.

## [5.32.8] - 2026-11-22

### Fixed

- The notification permission prompt no longer covers the welcome screen on a
  first run. It is requested after onboarding finishes, so the prompt follows the
  explanation of what the app will notify about.
- Search results no longer repeat the count ("6 CATALOG RESULTS" plus a "6"
  badge).

## [5.32.7] - 2026-11-22

### Fixed

- MBS I-WAV and Inter Projekt read stock from the first result on the page
  instead of the card the price came from, so a matched product could inherit a
  different product's stock status. Both now scope the stock lookup to the
  matched card, with tests that fail on the old behavior.

## [5.32.6] - 2026-11-21

### Changed

- `titleMatchesModel` moved into the shared scraper helpers so any parser that
  reads search-result titles can reject sibling variants, accessories, service
  plans, and used stock. Linitx now uses the shared implementation instead of a
  local copy. No other parser's behavior changed.

## [5.32.5] - 2026-11-21

### Fixed

- Linitx model matching now rejects sibling variants (U7-Pro-Wall,
  USW-Flex-Mini), accessories (mounts, stands, enclosures), service plans, and
  open-box or refurbished listings. U7-Pro had been reported at £38.39 from a
  wall mount, and USW-Flex at £27.59 from a Flex Mini.

## [5.32.4] - 2026-11-21

### Fixed

- Linitx search pages are parsed per result row. Service plans such as
  "UI CARE for UCG-Ultra" are rejected instead of being reported as the product,
  which had shown £18.46 instead of the £104.39 gateway and fed wrong alert
  prices. The parser now returns the product URL, not the search URL.
- "Awaiting Restock" stock text maps to back order on mobile and desktop.
- The Alerts header no longer overlaps the Restock Watches button on narrow
  screens.
- eBay "blocked" and "unreadable" results get accurate messages instead of
  blaming the user's connection.

## [5.32.3] - 2026-11-21

### Added

- Local, EAS-free push setup. `android.googleServicesFile` is added only when
  `google-services.json` exists (or `GOOGLE_SERVICES_JSON` points at it), and the
  build records whether it was included. `scripts/check-push-setup.sh` reports
  missing local inputs and the setup steps.

### Changed

- Push Diagnostics distinguishes a missing Expo project ID from a missing
  Android Firebase config, and token registration skips when either is absent.

## [5.32.2] - 2026-11-21

### Added

- `scripts/verify-android-artifact.sh` rejects debug-signed APKs, APKs without
  `arm64-v8a`, wrong package names, and AABs whose signature does not verify. It
  prints the versionCode and SHA-256. `scripts/android-release.sh` runs it on the
  artifacts it built.

### Changed

- Push Diagnostics warns when the build has no push service configured, and the
  empty state no longer suggests signing in as the fix. Project-ID lookup is
  shared with token registration and ignores blank values.

### Fixed

- The Distributor Analysis export control meets the 44 dp touch target.
- Android screen readers announce the background-refresh permission message.

## [5.32.1] - 2026-11-21

### Fixed

- Background refresh no longer turns on when Android's display-over-other-apps
  permission is missing. The switch stays off and the reason is shown. After
  granting access, returning to the app enables it automatically.
- The permission gate applies only on Android, where the overlay renderer
  exists, instead of blocking the toggle on iOS and web.
- Distributor Health ignores a second "Test All Distributors" tap while a check
  is running, and its empty-state action is hidden during the check.
- Page headers use a 44x44 back target. The Privacy header no longer scrolls out
  of reach, and the Statistics share action has a 44x44 target.

## [5.32.0] - 2026-11-17

### Changed

- UX/UI Phase 2B:
  - Added the shared `PageHeader` and migrated Statistics, Health, Sourcing,
    Build Order, Diagnostics, Restock Watches, Distributor Analysis, Available
    Now, and Privacy.
  - Stock-watch and reminder cards now use the compact horizontal action row
    (Stop watching / Reschedule / Delete).
  - Health no longer renders two “Test All Distributors” buttons in the empty
    state.

## [5.31.0] - 2026-11-17

### Changed

- UX/UI Phase 2A:
  - Privacy now has a visible back control.
  - Triggered alert history uses the same compact horizontal action row as
    active alerts.
  - Home labels its drop window as 7D, and Stats explains that its Movers card
    excludes out-of-stock clearance drops instead of claiming no history.
  - Onboarding steps 2 and 3 now share the same constrained width as step 1.

## [5.30.3] - 2026-11-17

### Added

- Home’s empty state now offers **Pick popular products**, reopening the guided
  welcome and product picker without re-showing it automatically.
- Settings → About has **Show welcome again** for anyone who dismissed the
  first-run flow.

## [5.30.2] - 2026-11-17

### Changed

- First-run now opens on a short value-prop welcome (“Find it. Price it. Get
  alerted.”) with “Pick products to track” and “Explore first” before the
  product picker. The picker remains the first step of the guided setup, but no
  longer acts as the app’s front door.
- Web onboarding now injects the shared focus-visible styles, and the
  accessibility smoke run dismisses the welcome via “Explore first”.

## [5.30.1] - 2026-11-17

### Fixed

- Alert tabs hide their icons below 430px so all three labels and counts fit at
  390px; counts are also announced by screen readers.
- Alert cards keep three lines of information plus a 44px action row within the
  compact target by folding distributor/snooze/triggered state into the target
  line.
- A lone onboarding result keeps half-width instead of stretching across the
  full desktop grid.
- Trending keeps the API on port 3000 during local Metro development while
  still using the page origin in production.
- The product-detail stock badge counts any visible in-stock listing, including
  quote-only or unconvertible-price listings, and shows “No data” when empty.
- Watchlist’s checking progress uses a compact count so the action row stays on
  one line.

## [5.30.0] - 2026-11-17

### Changed

- App-wide UX/UI Phase 1: product detail now has a visible back control, an
  honest stock badge derived from the region-filtered listings, and an
  uncropped product image.
- Alert cards are compact rows with horizontal Edit/Snooze/Delete actions;
  alert tabs use count badges and stay on one line at 390px.
- Signed-out users see “Signed out” instead of “Local only”; empty watchlist
  rows say “No prices yet” instead of “0 distributors”.
- Watchlist actions stay on one mobile row. Settings content clears the mobile
  tab bar.
- Discover uses a 3-column trending grid and a 2-column Available Now grid on
  wide screens, with product thumbnails.
- Onboarding is constrained to a readable width, uses a 2-column product picker
  on desktop, and has a visible 3-step progress bar.
- Fixed web Trending requests using `localhost:3000` instead of the page origin,
  which the CSP blocked.

## [5.29.1] - 2026-11-16

### Fixed

- OAuth sign-in no longer appears when the server has no Google/Apple
  credentials, and `/api/auth/oauth/start` returns an explicit "not configured"
  error instead of redirecting to a route that never existed.
- AI discovery reports a setup message and points at Settings → AI / LLM when
  neither Forge nor `OPENAI_API_KEY` is configured, instead of failing with a
  500. The settings screen now reports the real built-in provider state.
- Android and desktop release builds bake `EXPO_PUBLIC_*` / `VITE_*` production
  URLs. Previously released installers could ship as "Local only" with no
  sign-in, sync, push, or server-backed prices.
- Android release builds bump `versionCode` to 5.

## [5.29.0] - 2026-11-16

### Changed

- Rebranded the project from Product Stock Finder to OmniShop across the repo,
  npm package, Expo slug, URL scheme, native module names, cache directories,
  backup format, documentation, and release tooling.
- New store identities: Android `app.siamcreations.omnishop`, iOS
  `app.siamcreations.omnishop`, desktop `app.siamcreations.omnishop.desktop`.
  Android `versionCode` is now 4. Existing installs under the old bundle id do
  not upgrade in place.
- Web/API now run at `https://omnishop.siamcreations.app`; support mail is
  `support@siamcreations.app` and transactional mail uses
  `no-reply@siamcreations.app` via Resend.
- Legacy backups (`product-stock-finder-backup`), the old OAuth scheme,
  `PSF_*` env vars, cookie jars, and desktop data directories are still
  accepted or migrated on first use.

### Security

- Cleared production audit advisories: `node-forge` 1.4.3, `qs` 6.16.1,
  `decode-uri-component` 0.5.1, `glob` 14.0.2, `minimatch` 11.0.1. The
  obsolete node-forge patch was removed; `deepmerge` remains a documented
  no-fix ignore.

## [Unreleased]

### Security

- Share invitations require a verified email. Both invite paths silently skip
  unverified accounts, closing a pre-registration takeover of invite-only
  shares (password login does not require verification).
- Product-page hops extracted from scraped HTML are pinned to the search
  origin, so a compromised result page cannot make the server fetch arbitrary
  hosts (SSRF).

### Fixed

- The production image builds again: `patches/` is copied before the dependency
  install, dev dependencies are installed for `pnpm build`, and
  `NODE_ENV=production` is set only after the build. `.env`/`credentials/` are
  excluded from the build context, and CI now builds the image.
- Re-discovery preserves a listing's stored price history instead of replacing
  it with the single fresh point.
- Sync drops malformed pulled listings and skips an unappliable row instead of
  wedging the cursor for every later pull.
- Desktop JSON import merges the backup into local data (the native path used
  to replace every collection) and stamps sync metadata for the imported rows.
- Desktop basket alerts, digests, and server notification uploads ignore
  acquired products, matching mobile and desktop Stats.
- Production starts by applying committed migrations; CI applies them and fails
  on schema drift instead of generating a migration on the fly.

### Changed

- Rebranded the app to **OmniShop** with a new icon, adaptive icon, monochrome
  notification icon, splash art, and matching web/desktop icons. The package /
  bundle id, slug, scheme, storage keys, and signing key are unchanged.
- Fresh installs start with an empty watchlist. The demo seed
  (`lib/launch-seed.ts`) is removed from the mobile and desktop launch paths;
  `lib/sample-data.ts` still supplies preview/detail listings for CRS804/CRS326
  when a user adds them.

## [5.28.2] - 2026-10-25

### Security

- Patched `node-forge` 1.4.0 for CVE-2026-85393 (RSA PKCS#1 v1.5
  signature forgery via extra nested `DigestAlgorithm` elements). The upstream
  fix is applied with `pnpm patch` (no release exists yet) and guarded by a
  regression test using the published forged signature.

### Fixed

- Session expiry is detected from `UNAUTHORIZED` / device-revoked tRPC
  responses: the app signs out, shows "Session Expired", and skips protected
  push/notification calls while signed out.
- Local data is isolated across accounts. The previous account id is remembered
  before local data is cleared on session expiry, device revocation, or account
  deletion, so signing into a different account wipes the old watchlist and
  signing back into the same account preserves it.
- Price discovery is progressive: distributor lookups checkpoint per
  distributor, return partial results on timeout, and retry the remaining
  distributors on demand ("Find more prices").
- Browser-backed scraping falls back to headless with a warning when
  `PSF_BROWSER_HEADED=1` but the X display is missing or dead;
  `scripts/start-production.sh` only enables headed mode when Xvfb's socket
  exists.
- The production image builds on Node 22 (was 20), matching `engines.node`.
- DB suites were realigned with the non-enumerable invite behavior and
  server-generated notification event ids (CI was red on `main`).

### Changed

- Android `versionCode` 3.

## [5.28.1] - 2026-10-23

### Security

- Patched 11 transitive dependency advisories via pnpm overrides:
  `proxy-addr` (critical IPv4-mapped IP spoofing), `shell-quote` (critical
  command injection), `body-parser`, `source-map-js`, `compression`,
  `postcss-selector-parser`, and `zod`; bumped `undici` to 7.30.1.
  `pnpm audit --prod` is down from 12 findings (2 critical, 7 high) to 1
  (node-forge, which has no patched release and is build-time only).

### Fixed

- `sharedWatchlists.join` no longer downgrades an invited editor to `viewer`.
- `lib/server-prices.ts` treats a non-JSON body as a miss instead of throwing.
- `sharedWatchlists.listJoined` batches its share and owner lookups (was 2N
  queries).

### Changed

- Split the remaining large modules: `lib/sync.ts` pull/full-resync,
  `lib/csv.ts`, `lib/server-notifications.ts`, `server/devices.ts`,
  `lib/scrapers/utils.ts`, `server/routers/shared-watchlists.ts`.
- Extracted the mobile watchlist, search, health, product-detail, and
  manual-add screen hooks; extracted the desktop app shell and bootstrap.
- Removed the remaining `any` casts at typed boundaries and relied on the
  `Card` primitive in more shells.

## [5.28.0] - 2026-10-23

### Fixed

- Share invitations are no longer account-enumeration oracles: `inviteByEmail`
  and `invite` return only `{ invited: true }`, and unknown user ids no longer
  surface a `NOT_FOUND`.
- Notification events use server-generated ids instead of the client-supplied
  primary key, preventing cross-user collisions.
- Test-push no longer blocks the request for ~15 s waiting on Expo receipts.
- `notifications.pushStatusAll` batches push outcomes and scopes device labels
  to the caller instead of reading every tenant's labels.
- Rate limits key on the authenticated user (IP fallback for public routes), so
  shared NAT users no longer exhaust one bucket and address rotation no longer
  bypasses the limit.
- The desktop browser pool closes disconnected Chrome processes instead of
  leaking one per crash.
- Desktop scraper status reads the circuit breaker instead of inferring health
  from `lastChecked` (which is stamped on failures too).
- The drops tab is a real tab (no back button); the full-screen route falls back
  to Home when there is no history.
- CSV import supplies real brand/category/model defaults instead of
  `as unknown as Product`.

### Changed

- Decomposed the largest screens and modules into focused hooks/components:
  mobile watchlist, settings, product detail, search, alerts, stats, health,
  compare, drops, onboarding, manual add, login, account, notifications; desktop
  watchlist, settings, product detail, compare, stats, health, search, alerts,
  home, and the app shell.
- Unified desktop `Search` and `SearchModal` on one `useCatalogSearch`.
- Added `createPriceAlert` (save-then-schedule, deterministic id) and migrated
  the product-detail and compare flows.
- Consolidated the desktop localStorage adapters and replaced `window.confirm`
  with a shared confirm dialog.
- Shared currency conversion math between the static and live-rate layers.
- Added coverage thresholds for `lib/` and `hooks/`, plus behavior tests for the
  refactored hooks.
- Accessibility: labeled login inputs, header/alert roles, 44 px touch targets,
  and reduced-motion support across the animated components.
- Removed the unused `axios` dependency and dead template scripts; fixture
  regeneration now requires `--force`.
- Added `cargo fmt --check` and `cargo clippy -D warnings` to `pnpm verify`.

## [5.27.3] - 2026-10-20

### Fixed

- Configured the Tauri updater signing key (public key in `tauri.conf.json`,
  private key in the `TAURI_SIGNING_PRIVATE_KEY` repo secret), unblocking the
  signed desktop release.

## [5.27.2] - 2026-10-20

### Fixed

- Pinned `@tauri-apps/plugin-updater` to 2.12.0 to match the Rust
  `tauri-plugin-updater` crate, unblocking `tauri build` in the release workflow.

## [5.27.1] - 2026-10-20

### Fixed

- Desktop release workflow: `@tauri-apps/cli` is now a desktop devDependency,
  so `pnpm tauri build` resolves instead of failing with `tauri: not found`.

## [5.27.0] - 2026-10-20

### Changed

- Upgraded to Expo SDK 58 (React Native 0.88, React 19.3, Expo Router 58,
  expo-notifications 58.1.5). Requires Node >= 22.13.0.
- Migrated watchlist swipe actions to `ReanimatedSwipeable`.
- Hidden tabs (`rates`, `settings`) now use `tabBarButton: null` because
  expo-router 58 redirects away from `href: null` tabs.
- Desktop React aligned to 19.3.0; desktop production build fixed.
- Enabled all seven React Compiler lint rules.

### Fixed

- Android notifications now deliver on SDK 58 (the previous expo-notifications
  build failed with `NotSerializableException: android.net.Uri$HierarchicalUri`).
- R8 no longer strips Room's generated database constructor, which crashed
  WorkManager at startup in release builds.
- Gradle 9 compatibility: removed `jcenter()` from the cookies dependency via a
  pnpm patch; updated the Android project to Gradle 9.4.1 / AGP 9.
- Added the missing `push_delivery_log` migration (schema drift).

## [5.26.1] - 2026-10-15

### Fixed

- A release APK built with a loopback API URL ran in Local mode, so every
  server-backed feature (eBay search, sync) failed with a generic error. An
  opt-in `PSF_ANDROID_HTTP_TEST_API=1` build now scopes cleartext HTTP to the
  configured API host only, and the eBay section reports a distinct
  "no reachable API server was configured" state instead of a retryable
  network error.
- The Facebook Marketplace section vanished silently after the "Checking…"
  spinner when the on-device check failed. It now shows reconnect guidance,
  and renders only for a verified-ready session: signed-out users see a
  results-only search with no spinner or nag card.

### Changed

- "Search Facebook Marketplace" (the location and radius sheet) moved from
  Discover into Settings → Connected marketplaces, so Discover search stays
  results-only.

## [5.26.0] - 2026-10-14

### Fixed

- Discover search for a trending product (for example "dgx spark") returned
  zero results. Trending products are now searchable: a "Trending matches"
  section appears in the results, and the Add button tracks any trending
  product instead of rejecting one that is not in the static catalog. The
  Category and Brand filter chips collapse behind a "Filters" toggle while
  searching so results are no longer pushed below the fold, and the empty state
  reads "No catalog matches" instead of a contradictory "No results".

### Added

- A project verification skill (`.claude/skills/verify/`) that drives the
  Android app in an emulator and captures screenshots, with a feature map for
  Discover search, Watchlist, Product detail, Alerts, and onboarding.

## [5.25.0] - 2026-10-13

### Added

- eBay keyword search in Discover (Phase 1151): typing a query now shows an
  "eBay listings" section inline with catalog results, with image, title,
  price, condition, seller, and shipping, and a Track button per row. The
  server uses the eBay Browse API when `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`
  are set, and falls back to a browser-rendered search page otherwise (an
  anonymous session that never touches distributor cookies). Verified empty
  results, blocked pages, and unreadable pages stay distinct, so a failed
  search is never shown as "no matches".

## [5.24.0] - 2026-10-13

### Added

- eBay support (Phase 1150): import `ebay.io` short links or canonical
  `ebay.com/itm/{id}` links, track as USD listings (displayed in THB via FX),
  and check prices on-device (browser-first, since datacenter fetches are
  blocked). The parser reads JSON-LD price, currency, availability, and
  condition. eBay listings upgrade to automatic monitoring on a verified
  identity and price. 33 distributors / 28 parsers, with a Rust port.

### Fixed

- Discover now renders the shared search engine, so typing a query shows
  catalog and Facebook Marketplace results in place. Trending and Available
  Now appear only when the query is empty, and the Facebook search sheet
  inherits the current query.

## [5.23.0] - 2026-10-13

### Added

- Connected Marketplaces (Phase 1149): a visible login browser for Facebook,
  Shopee TH, and Lazada TH; evidence-based connection status (ready, sign-in
  required, couldn't verify, unavailable) with timestamps; scoped disconnect
  that clears only the selected site and reports failures; shared Facebook
  search location and radius with observed-vs-requested scope; and search
  recovery that retries the retained query once after a verified reconnect.

### Changed

- Marketplace page extraction now binds each listing to its own card, so
  neighbouring listings cannot exchange titles, prices, or locations. A header
  login link is no longer treated as a login wall, and unreadable results are
  distinct from a verified empty result set.

## [5.22.0] - 2026-10-12

### Added

- Facebook Marketplace support (Phases 1147–1148): import item/share links
  (server resolves via a bounded headed render — identity only), track as
  manual-monitoring THB listings with title-change protection, on-device
  "Check price" when signed into Facebook in the app browser, and an inline
  "Facebook Marketplace (N)" section in Discover search results (session-gated,
  with distinct sign-in/empty/unavailable states). Facebook listings are
  excluded from all automatic pipelines and the global price cache.

## [5.21.0] - 2026-10-12

### Added

- Lazada Thailand marketplace support (Phase 1146), mirroring Shopee TH:
  short-link import with variant confirmation, `lazada-th` parser
  (plain-fetch first), on-device price checks with variant-matched upgrade
  to automatic monitoring, Rust port, and full pipeline exclusion for
  manual products. 32 distributors / 27 parsers.
- Shopee TH automatic price checks (Phase 1145): on-device "Check price
  now" with variant-matched flip to automatic, `shopee-th` parser
  (browser-first), login-wall handling via Site sessions, Rust port.

## [5.20.0] - 2026-10-12

### Changed (app redesign, Phases 1140–1143)

- New tab bar: Home · Discover · Watch · Drops · Alerts. Rates and Settings
  leave the tab bar (still reachable); Drops promoted from hidden route to tab.
- New Discover tab composing catalog search + Trending + Available Now, with
  inline track buttons.
- New You stack screen (profile + Statistics / Rates / Health / Diagnostics /
  Settings links), reached via the Home gear shortcut.
- Concierge onboarding replaces the carousel: hunt (catalog multi-select) →
  ship (country + tax) → notify (alert/stock/digest toggles) → done. Price
  alerts auto-activate on first prices via a pending queue fulfilled by every
  price check (foreground and background).
- Home is now a priority feed: greeting + urgency-ordered cards (alerts fired,
  big drops, restocks, all-quiet) + watchlist preview. Stat cards, recent
  activity, away card, and the old Available/Trending sections removed.
- Watch rows gain swipe actions (alert / acquired / remove); filters collapse
  into one bar with an active-count badge.
- Visual pass: 16px card radius, 56px touch targets, 28px screen titles on key
  screens.

## [5.19.0] - 2026-10-11

### Added

- Push delivery diagnostics: per-device delivery status screen (`/diagnostics`,
  reached from Settings → Notifications) with live "Send test push" and
  user-facing explanations for Expo errors. The server now checks Expo receipts
  ~15s after each send and persists the outcome per device (`pushDeliveryLog`
  table); new `pushStatusAll` query and rate-limited `sendTestPush` mutation.
  Full desktop parity.

## [5.18.0] - 2026-10-11

### Added

- Mark as acquired: flag products you've already bought (`Product.acquiredAt`,
  card + detail toggle, "Show acquired" filter, dimmed rows). Acquired products
  are excluded from price alerts, restock watches, basket stats, digests and
  server notification uploads. Full desktop parity (watchlist, detail, stats,
  home, Rust price-drop checker).
- Price drop leaderboard: biggest drops across tracked products (local) and all
  products (`prices.topDrops` server query over `priceHistory`). Home preview
  (top 5) + full `/drops` screen (top 20, Your/Global tabs, 24h/7d/30d windows,
  %/$ ranking, clipboard sharing). Full desktop parity (page, section, sidebar).

## [5.17.0] - 2026-10-04

### Added

- Desktop auto-update via `tauri-plugin-updater`, with a check/install control in
  Settings → About → Updates.
- GitHub Actions release workflow (`tauri-apps/tauri-action`) that builds, signs
  and publishes the desktop installers plus the `latest.json` updater manifest on
  a `v*` tag.
- DB-backed tests for the shared-watchlist router's authorization paths, and
  branch tests for `lib/csv.ts` and the app error boundary.

### Changed

- Desktop bundle split into vendor chunks with lazy per-route pages: the entry
  chunk dropped from 1,269 KB to 232 KB (gzip 366 KB → 65 KB) and the
  ">500 KB chunk" warning is gone.
- `pnpm build:apk` now runs the standard `./gradlew assembleRelease`; the manual
  rebundle/repack/re-sign workaround was removed.
- Replaced the `recharts` dependency with hand-rolled SVG charts.

### Fixed

- Desktop mirrored-file lost-update race: a single `STORE_FILE_LOCK` now
  serializes every READ-MODIFY-WRITE (watchlist/alerts/reminders/settings).
- Distributor cookie jar is written owner-only (`0600`).
- `parseWatchlistCsv` now actually skips a legacy `shareUrl,` header row.
- Removed dead diagnostic writes from the error boundaries.
- Fixed a flaky webhook-settings test.

### Security

- Share roster emails are returned only to the share owner.
- Updater downgrade hardening: `plugins.updater.requireSignedVersion`.
- `sharedWatchlists.inviteByEmail` no longer reveals whether an email has an
  account.
