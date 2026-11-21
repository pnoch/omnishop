#!/usr/bin/env bash
# Builds the Android release APK + AAB with the PRODUCTION API URL baked in.
#
#   scripts/android-release.sh            # apk + aab
#   scripts/android-release.sh apk        # apk only
#   scripts/android-release.sh aab        # aab only
#
# Why a script: `EXPO_PUBLIC_*` values are inlined into the JS bundle at build
# time, and Gradle caches that bundle. Building with the local `.env`
# (localhost:3000) produced an APK that could not reach the server, and a plain
# rebuild reused the cached bundle. This script sets the production URLs and
# forces the bundle task to re-run.
#
# Requires: JDK 17+, Android SDK, and credentials/ (scripts/android-keystore.sh).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

# Production API/web URL. Override with EXPO_PUBLIC_API_BASE_URL if needed.
API_URL="${EXPO_PUBLIC_API_BASE_URL:-https://web.omnishop.siamcreations.app}"
WEB_URL="${EXPO_PUBLIC_WEB_URL:-$API_URL}"

echo "Building with:"
echo "  EXPO_PUBLIC_API_BASE_URL=$API_URL"
echo "  EXPO_PUBLIC_WEB_URL=$WEB_URL"
echo

# Export before prebuild: app.config.ts reads these while generating the native
# manifest. Prebuilding from the dev .env produced App Links for localhost.
export EXPO_PUBLIC_API_BASE_URL="$API_URL"
export EXPO_PUBLIC_WEB_URL="$WEB_URL"

echo "Running expo prebuild with production URLs..."
(cd "$REPO_ROOT" && npx expo prebuild --platform android --no-install)

if [ ! -f "$REPO_ROOT/credentials/keystore.properties" ]; then
  echo "ERROR: credentials/keystore.properties missing." >&2
  echo "Run scripts/android-keystore.sh first (or restore your backup)." >&2
  exit 1
fi

# Force the JS bundle to regenerate so the env values above are actually baked.
rm -f "$REPO_ROOT/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle"
rm -f "$REPO_ROOT/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle"

APK_OUT="$REPO_ROOT/android/app/build/outputs/apk/release/app-release.apk"
AAB_OUT="$REPO_ROOT/android/app/build/outputs/bundle/release/app-release.aab"

GRADLE_TASKS=()
ARTIFACTS=()
case "$TARGET" in
  apk) GRADLE_TASKS=(assembleRelease); ARTIFACTS=("$APK_OUT") ;;
  aab) GRADLE_TASKS=(bundleRelease); ARTIFACTS=("$AAB_OUT") ;;
  all) GRADLE_TASKS=(assembleRelease bundleRelease); ARTIFACTS=("$APK_OUT" "$AAB_OUT") ;;
  *) echo "Usage: $0 [apk|aab|all]" >&2; exit 1 ;;
esac

"$REPO_ROOT/android/gradlew" -p "$REPO_ROOT/android" "${GRADLE_TASKS[@]}"

# A debug-signed or emulator-ABI APK has shipped before. Check before publishing.
echo
echo "Verifying artifacts..."
"$REPO_ROOT/scripts/verify-android-artifact.sh" "${ARTIFACTS[@]}"

echo
echo "Artifacts:"
[ -f "$APK_OUT" ] && echo "  APK: $APK_OUT"
[ -f "$AAB_OUT" ] && echo "  AAB: $AAB_OUT"
