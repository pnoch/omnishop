# Release Runbook

How to cut and ship OmniShop. Two build targets share one version
number: **mobile/web** (Expo) and **desktop** (Tauri). `tests/version-lockstep.test.ts`
enforces that `package.json`, `app.config.ts`, `desktop/package.json`,
`desktop/src-tauri/tauri.conf.json`, `Cargo.toml` and `Cargo.lock` agree, so bump
them together (see [Version bump](#1-version-bump)).

Everything here runs from the repo root unless noted. `android/`, `ios/`,
`dist/`, `dist-web/`, `credentials/`, `.env*` are gitignored.

---

## 0. One-time setup (do once per machine / org)

### Node

Expo SDK 58 requires Node **>= 22.13.0** (`package.json` → `engines`). CI and
the release workflow use Node 22.

### Android signing keystore

```bash
scripts/android-keystore.sh
```

Writes (gitignored) `credentials/release.keystore` + `credentials/keystore.properties`
(`storeFile=../../credentials/release.keystore`). It prints the **SHA-256**
fingerprint — save that; it's needed for App Links. `plugins/with-android-release-signing`
re-applies the Gradle signing config on every `expo prebuild` (otherwise a
prebuild falls back to the debug key, which Play rejects).

**Back up the keystore now.** Losing it means the app can never be updated on
Play under the same package name.

### Desktop updater signing key

```bash
cargo tauri signer generate -w ~/.tauri/psf-updater.key -p ""
```

Put the printed/`~/.tauri/psf-updater.key.pub` **public** key into
`desktop/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, and add the
**private** key as a GitHub repo secret `TAURI_SIGNING_PRIVATE_KEY` (optionally
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). `bundle.createUpdaterArtifacts` is on, so
until the real pubkey is set a `tauri build` fails closed (the placeholder isn't
valid base64).

### Android push (FCM), local setup without EAS

Remote push needs two local settings and one dashboard setting. No EAS login or
`eas init` is required to build and run this locally.

1. **Firebase**: create an Android app for `app.siamcreations.omnishop`, download
   `google-services.json`, and put it in the repo root. `app.config.ts` adds it to
   the native build only when the file exists (`GOOGLE_SERVICES_JSON` overrides
   the path) and exposes the result as `extra.googleServicesFile`.
2. **Expo project**: create a project in the Expo dashboard and put its project
   ID in `.env` as `EXPO_PUBLIC_EXPO_PROJECT_ID`. This is only an identifier; it
   does not require the EAS CLI.
3. **FCM credentials on that Expo project**: Expo Push forwards to FCM, so the
   Firebase credentials must be registered on the Expo project in the dashboard
   (Credentials). `eas credentials` does the same if you adopt EAS later.

Check the checkout before building:

```bash
scripts/check-push-setup.sh
```

A missing piece is not fatal. Local notifications and scheduled background price
checks still work; server/remote push no-ops until both settings are present and
the app is rebuilt. Native config and `EXPO_PUBLIC_*` values are baked at build
time, so changing either requires a new build. Removing the file later needs
`npx expo prebuild --platform android --clean` so the generated project drops the
copied config.

---

## 1. Version bump

```bash
# 5.17.0 -> 5.18.0 (minor) or 5.17.1 (patch)
# edit all six in lockstep:
#   package.json, app.config.ts, desktop/package.json,
#   desktop/src-tauri/tauri.conf.json, desktop/src-tauri/Cargo.toml
# then reconcile the lock:
cargo check --manifest-path desktop/src-tauri/Cargo.toml   # updates Cargo.lock
# Android: increment `android.versionCode` in app.config.ts for every Play upload.
```

Add a `CHANGELOG.md` section headed `## [<version>] - <date>`. Verify:

```bash
pnpm exec vitest run tests/version-lockstep.test.ts
```

---

## 2. Pre-flight (always)

```bash
pnpm verify        # check + lint + test + check:desktop + desktop test + cargo test
DATABASE_URL=... pnpm db:backup   # before releases/migrations (see Backups)
```

The browser release gates need the web export first:

```bash
pnpm build:web
pnpm audit:layout && pnpm audit:contrast && pnpm e2e:smoke
DATABASE_URL=... pnpm e2e:shared   # live/expired/unknown, members-only, join/leave
pnpm build:desktop && pnpm audit:desktop
pnpm budget:web
```

If you touched `server/` or `shared/`, run the DB suite too (Docker):

```bash
docker run -d --name psf-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=psf_test -p 3306:3306 mysql:8.4
DATABASE_URL=mysql://root:root@127.0.0.1:3306/psf_test pnpm db:migrate
RUN_DB_TESTS=1 TEST_DATABASE_URL=mysql://root:root@127.0.0.1:3306/psf_test pnpm test:db
```

### App Links / deep links

Set `EXPO_PUBLIC_WEB_URL=https://web.omnishop.siamcreations.app` in the build
environment **before** bundling, so `app.config.ts` emits the
`https://web.omnishop.siamcreations.app` intent filter with `autoVerify` (and
the iOS `associatedDomains`). It falls back to `EXPO_PUBLIC_API_BASE_URL`, and
if neither is set there is no https App Link. IONOS does not allow a CNAME at
the apex, so the app lives on its own subdomain; `omnishop.siamcreations.app`
is the landing/download page and `www`/apex are reserved for the company site.

On the server, set `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated SHA-256
from the keystore) so `/.well-known/assetlinks.json` is served; App Links won't
verify without it. (Apple equivalent: `APPLE_TEAM_ID` for the AASA file.)

Env changes are baked at bundle time and Metro caches transforms — rebuild with
`--clear` / `--reset-cache` after changing `EXPO_PUBLIC_*`.

---

## 3. Android release (APK)

`android/` is generated, so the release script prebuilds first, then builds. It
bakes the production API/web URLs into both the native App Links and the JS
bundle (`pnpm build:apk` alone reuses whatever URL was last cached, including
the dev localhost):

```bash
scripts/android-release.sh apk                # signed APK, production URLs baked in
scripts/android-release.sh aab                # Play Store bundle
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed with
`credentials/release.keystore`, R8-minified, hardened: scoped cleartext,
`SYSTEM_ALERT_WINDOW` kept for the overlay renderer, `allowBackup=false`,
scoped storage perms). Prebuild also regenerates Gradle 9.4.1 and applies the
Room constructor keep rule (`plugins/with-android-r8-keep-rules`).

`android-release.sh` verifies the artifacts it built before printing their
paths, and the verifier can be re-run on a downloaded asset:

```bash
scripts/verify-android-artifact.sh \
  android/app/build/outputs/apk/release/app-release.apk \
  android/app/build/outputs/bundle/release/app-release.aab
```

It fails on the debug key, a non-ARM APK, or a wrong package, and prints the
versionCode and SHA-256. Compare the printed signer digest with the release key:
existing key `CN=Product Stock Finder` (`3d4b5642…549ecc`); a regenerated key
(`scripts/android-keystore.sh`) is `CN=OmniShop`.

Upload to Play Console (internal track). `versionCode` is whatever
`android/app/build.gradle` has after prebuild; Play requires it to increase per
upload. **EAS alternative:** `eas build -p android --profile production`
(`eas.json` has `autoIncrement: true` and production `EXPO_PUBLIC_*` env) +
`eas submit -p android`. When EAS asks to generate a keystore, **upload the
existing `credentials/release.keystore` instead** (same alias/password); a new
key cannot update the installed app or the Play listing. The locally built
`app-release.aab` is already signed with that key and can be uploaded directly.

> Native push needs an EAS project: `registerPushToken` reads
> `extra.expoProjectId`, then falls back to the EAS-linked project ID. Run
> `eas init`/`eas login` once (or set `EXPO_PUBLIC_EXPO_PROJECT_ID`) before
> building the store binaries, otherwise price alerts only fire while the app
> is open.

> Standalone behaviour: a release build with a loopback `EXPO_PUBLIC_API_BASE_URL`
> (e.g. the dev `http://localhost:3000`) runs local-only on-device; prices come
> from on-device scraping in a hidden WebView while the app is open.

---

## 4. Desktop release (Tauri)

Tag-triggered, all platforms. Bump the version first (step 1) and make the tag
match `tauri.conf.json`:

```bash
git tag v5.18.0
git push origin v5.18.0
```

`.github/workflows/release.yml` (tauri-action) then builds macOS (universal),
Linux and Windows, signs with `TAURI_SIGNING_PRIVATE_KEY`, and uploads the
installers + `latest.json` to the GitHub Release. The release is created as a
**draft** — publish it so it becomes `latest`, which is what the updater
endpoint points at:

```
https://github.com/pnoch/omnishop/releases/latest/download/latest.json
```

`plugins.updater.requireSignedVersion` is on, so the artifact signature must
carry the version (built by a current tauri-cli).

Manual/local build (Linux leg):

```bash
cd desktop
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/psf-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  cargo tauri build            # add --bundles deb to skip AppImage tooling
# artifacts under desktop/src-tauri/target/release/bundle/
```

The in-app **Settings → About → Updates** row checks the endpoint and installs
an available update (Windows exits to install; macOS/Linux apply on restart).

> Desktop builds talk to the API cross-origin from `tauri://localhost` /
> `http://tauri.localhost` / `https://tauri.localhost`. The server must include
> those in `CORS_ALLOWED_ORIGINS` (Railway has this set), otherwise the app
> shows **Offline / Backend unreachable** even though the API is healthy.

---

## 5. Web deploy

```bash
pnpm build          # esbuild server bundle (dist/) + expo web export (dist-web/)
pnpm start          # production server; serves dist-web at / with SPA fallback
```

The API server hosts `dist-web/` same-origin (`server/spa.ts`). Web release
builds are `output: "single"` (SPA); don't switch to `static` (NativeWind
hydration mismatch). Web push needs `VAPID_*` (server) +
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` (client).

### Container deploy (Railway)

The repo ships a `Dockerfile`; Railway builds it in preference to Nixpacks.
The image installs Chromium + Xvfb and starts the server via
`scripts/start-production.sh`, which runs Xvfb on `:99` and sets
`OMNISHOP_BROWSER_HEADED=1`. Headed Chromium is required: Cloudflare's gate keys on
headed-ness, so headless returns 403 for Winncom/B&H (see Phase 1106). Ensure
the Railway service is connected to the GitHub repo (not a bare image) so the
Dockerfile is built on deploy.

The image runs as the non-root `node` user (uid/gid 1000); Chromium lives in
`/ms-playwright` and distributor session cookies in `$HOME/.cache/omnishop`.
If you mount a volume to keep those sessions across deploys, mount it at
`/home/node/.cache` and make it writable by uid 1000. Without a volume the
cookies are ephemeral and Cloudflare challenge passes must be redone after
each restart. CI's `docker` job asserts the image runs as `node`/uid 1000.

CI also runs the layout, contrast, and first-run journey gates plus a check
that `credentials/` is never tracked; all actions are pinned to commit SHAs.
Re-run the browser gates locally after UI changes (above).

`DATABASE_URL` must be set; `scripts/start-production.sh` applies the committed
migrations (`pnpm db:migrate`) before the server starts. Use `pnpm db:push` only
while changing the schema, and commit the generated SQL — CI's
`pnpm db:check-migrations` fails on drift.

### Ops status

`GET /api/healthz` is the Railway health check (200/503 on database
reachability). `GET /api/status` is the operator snapshot: database state,
process age/memory, the warmer's last tick (`lastOk`, `failedSteps`, duration, per-step
timings), the thumbnail encoder queue, and cache sizes. It is rate limited (60/min/IP)
and cached for 5 s, so it is safe to poll:

```bash
curl -fsS https://web.omnishop.siamcreations.app/api/status
```

### Backups

Take a logical backup before every migration, release, or manual data change:

```bash
DATABASE_URL=... pnpm db:backup
# → backups/omnishop-YYYYMMDD-HHMMSS.sql.gz (schema + data, mode 0600)
```

The dump contains emails and password hashes. Store it off-site, encrypted at
rest (for example with `age` or `gpg`), and never commit it — `backups/` is
gitignored. The scripts use local MySQL 8 client tools when installed and fall
back to the `mysql:8.4` Docker image. `BACKUP_KEEP` (default 14) prunes old
dumps in the target directory.

Railway's MySQL service may also offer dashboard backups depending on the
plan; check its retention separately. This dump is the artifact the restore
procedure below uses.

**Restore drill** — run it after changing the schema and before trusting a
backup:

```bash
# 1. Create an empty scratch database (the target must exist and be empty).
mysql -h ... -u ... -p -e "CREATE DATABASE psf_restore"

# 2. Restore into it. The script refuses the DATABASE_URL target and a
#    non-empty target unless --force is passed.
RESTORE_DATABASE_URL=mysql://.../psf_restore \
  pnpm db:restore backups/omnishop-....sql.gz --yes

# 3. Confirm the printed table/user/price counts, then drop the scratch DB.
```

For a real recovery: stop the app service, confirm the dump is the one you
want, restore into the real database with `--force`, run `pnpm db:migrate` if
the backup predates a migration, start the service, and check
`/api/healthz` and `/api/status`.

### Custom domain (`web.omnishop.siamcreations.app`)

The web app lives at `web.omnishop.siamcreations.app`; the brand subdomain
`omnishop.siamcreations.app` is the landing/download page (GitHub Pages,
`pnoch/omnishop-releases`). `www`/apex are reserved for the company site. The
app is served same-origin, so its custom domain fronts both the SPA and the API.
One-time setup:

```bash
railway login
railway link                 # select the OmniShop project + environment
railway domain web.omnishop.siamcreations.app --service app --json
```

The command returns the DNS target Railway expects:

```
web.omnishop.siamcreations.app  CNAME  <target returned by Railway>
```

Add that CNAME in IONOS DNS. Railway may also return a `verificationDnsHost` /
`verificationToken` (`_railway-verify.web.omnishop` → `railway-verify=…`); add
that TXT record too, otherwise the certificate stays in
`VALIDATING_OWNERSHIP`.

Do not point the apex MX at Railway; `support@siamcreations.app` stays on IONOS.
Wait for Railway to show the domain as verified and serving TLS, then check:

```bash
curl -sI https://web.omnishop.siamcreations.app/privacy
```

Set `EXPO_PUBLIC_WEB_URL=https://web.omnishop.siamcreations.app` on Railway
**and** in the EAS/CI build environment, then rebuild the web export and native
bundles (`EXPO_PUBLIC_*` is inlined at bundle time; use `--clear` after changing
it).
Do this only after the domain serves TLS: the server uses the same value to
validate OAuth redirect origins. That value also drives
`getPrivacyPolicyUrl()`, the Android App Link host, and the iOS associated
domain. Also set `ANDROID_SHA256_CERT_FINGERPRINTS` / `APPLE_TEAM_ID` as
described above so the well-known verification files answer for the new host.

Railway plans cap custom domains per service; remove unused domains (for
example the old `www` alias) before adding another subdomain.

### Transactional email (`siamcreations.app`)

`support@siamcreations.app` stays on IONOS (root MX unchanged). Only outbound
transactional mail uses Resend:

1. Resend dashboard → Domains → add `siamcreations.app`.
2. Copy the DKIM TXT record and the `send` subdomain MX/SPF records into IONOS
   DNS. Do not replace the root MX; the support inbox depends on it.
3. Set `EMAIL_FROM=no-reply@siamcreations.app` on Railway and keep the existing
   `RESEND_API_KEY`.
4. Verify end-to-end with `POST /api/auth/forgot` (expect a real Resend message
   id) and a test password-reset email.

### eBay search (Browse API)

Without a keyset the app falls back to a browser-rendered eBay search page, which
eBay blocks in production. The Browse API is free but needs a restricted Buy
integration:

1. Create a keyset at `https://developer.ebay.com/my/keys`. Start with Sandbox;
   the Developers Program is free.
2. On Railway set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`, plus
   `EBAY_ENVIRONMENT=sandbox` while sandbox keys are in use. eBay rejects
   sandbox keysets on the production hosts.
3. Production keys need an eBay Partner Network application and an Application
   Growth Check: `https://developer.ebay.com/api-docs/buy/static/buy-requirements.html`.

Verify a keyset against the live server:

```bash
curl 'https://web.omnishop.siamcreations.app/api/trpc/products.searchEbay?input=%7B%22json%22%3A%7B%22query%22%3A%22CRS326%22%7D%7D'
```

`source: "api"` means the keyset works. `reason: "blocked"` means the browser
fallback was used.

---

### Release page

The landing/download page lives in `pnoch/omnishop-releases` and is served by
GitHub Pages at <https://omnishop.siamcreations.app/> (custom domain, A/AAAA
records to GitHub Pages — not a CNAME, because `web.omnishop` is a child CNAME
to Railway). Edit `docs/index.html` and `docs/screenshots/` in that repository;
the app itself is at <https://web.omnishop.siamcreations.app>.

The Android button resolves the first `.apk` asset from the rolling
`android-latest` prerelease in `pnoch/omnishop`. Publish a new APK by replacing
that release's asset named `OmniShop-<version>.apk`; the page reads the asset URL
through the GitHub API, so no page edit is needed. The desktop button points at
`pnoch/omnishop/releases/latest`.

## 6. Post-release checklist

- [ ] `pnpm verify` green on the release commit.
- [ ] `CHANGELOG.md` has the version; version lockstep test passes.
- [ ] Android APK package `app.siamcreations.omnishop`, signed by the release key (existing cert `CN=Product Stock Finder`); `versionCode` increased.
- [ ] `assetlinks.json` returns 200 and lists the release SHA-256.
- [ ] Desktop `latest.json` published (not draft) and the app's update check finds it.
- [ ] Tag pushed; `main` pushed.

## Troubleshooting

- **`tauri build` fails to decode the pubkey** → `plugins.updater.pubkey` is still the placeholder; set the real minisign public key.
- **App Links don't open the app** → `EXPO_PUBLIC_WEB_URL` not set at bundle time, or `ANDROID_SHA256_CERT_FINGERPRINTS` missing/mismatched.
- **Android remote push silent** → no FCM credentials (step 0).
- **Browser-backed scrapes blocked / eBay search empty** → `OMNISHOP_BROWSER_HEADED=1` is set but the X display is gone. The server logs `[browser] ... falling back to headless` and keeps running headless; restart under `xvfb-run -a` (or `scripts/start-production.sh`) for Cloudflare-gated distributors.
- **Release APK rejected by Play** → built with the debug key; ensure `credentials/keystore.properties` exists before `expo prebuild`.
