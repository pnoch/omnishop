# Store Listing — OmniShop

Copy for App Store Connect and Google Play Console. Keep this in sync with
`app.config.ts` (name, bundle id, version) and `eas.json` (submit profiles).

## Identity

| Field | Value |
| --- | --- |
| App name | OmniShop |
| iOS bundle id | `app.siamcreations.omnishop` |
| Android package | `app.siamcreations.omnishop` |
| Version | `5.32.56` (EAS `appVersionSource: remote` manages build numbers) |
| Category | Utilities |
| Price | Free |

## Short description (Play Store, 80 chars max)

> Track stock and prices across 33 electronics distributors. Alerts and history.

## Full description

> OmniShop tracks product availability and prices across 33 global
> electronics distributors, with a focus on MikroTik and Ubiquiti networking
> gear.
>
> Build a watchlist, set target-price alerts, schedule back-order reminders, and
> watch for restocks. Compare price history across every distributor that
> carries a product, see the cheapest region, and get notified the moment a
> price drops or an item is back in stock.
>
> FEATURES
> • Watchlist with tags, sorting, and grouping
> • Price alerts — get notified when a price drops below your target
> • Restock watches — know the moment an item is available again
> • Back-order reminders for items on order
> • Price history charts and cross-distributor comparison
> • Distributor health dashboard showing which sites are reachable
> • 11 display currencies with live exchange rates
> • Works offline; syncs across your devices when you sign in
>
> No ads. No tracking SDKs. Your watchlist is yours.

## Keywords (App Store, 100 chars max)

> mikrotik,ubiquiti,network,switch,router,price,stock,alert,watchlist,distributor,hardware

## Support / legal URLs

| Field | Value |
| --- | --- |
| Privacy policy | `https://web.omnishop.siamcreations.app/privacy` (served by the SPA; override with `EXPO_PUBLIC_PRIVACY_URL`) |
| Support email | `support@siamcreations.app` (override with `EXPO_PUBLIC_SUPPORT_EMAIL`) |
| Marketing URL | `https://omnishop.siamcreations.app/` |

## Required assets

| Asset | Requirement | Source |
| --- | --- | --- |
| App icon | 1024×1024 PNG, no alpha (iOS); 512×512 (Play) | `assets/images/icon.png` |
| iPhone screenshots | 6.7" (1290×2796), 3–10 each | `pnpm store:assets` |
| iPad screenshots | 12.9" (2048×2732), since `supportsTablet` is true | `pnpm store:assets` |
| Android screenshots | Phone (1080×1920), 2–8 each | `pnpm store:assets` |
| Feature graphic | 1024×500 (Play) | `pnpm store:assets` |
| App preview video | Optional | — |

### Generating the images

```bash
# Capture the deployed app so real product images load (recommended):
STORE_BASE_URL=https://web.omnishop.siamcreations.app pnpm store:assets

# Or drive the local web export (local-only mode; product images are placeholders):
pnpm build:web
pnpm store:assets
```

The screenshots use a seeded demo watchlist (a few catalog products, an alert,
a reminder) and contain no user data. The feature graphic is composed from the
app icon and brand colours. Review the output before uploading; the iPad set is
only needed while `supportsTablet` remains true.

## Data safety / privacy answers

- **Data collected:** email address, display name (optional), hashed password,
  device identifiers, and user content (watchlist/alerts/reminders).
- **Purpose:** app functionality, account management, notifications.
- **Shared with third parties:** no. Prices are fetched from public distributor
  sites; no user data is sent to them.
- **Encrypted in transit:** yes (HTTPS).
- **Deletion:** in-app via Settings → Account → Delete Account.

## Submission commands

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform android --profile production   # track: internal, draft
eas submit --platform ios --profile production       # prompts for ascAppId
```

`eas submit` for iOS needs the App Store Connect app id (`ascAppId`) and an
Apple ID / app-specific password, or an API key — EAS prompts on first run.
