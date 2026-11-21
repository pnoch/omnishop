#!/usr/bin/env bash
# Reports whether this checkout can register an Android push token without EAS.
# Advisory only: the app still works without push (background checks run on a
# schedule). Run it before building a store APK.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATUS=0

project_id="${EXPO_PUBLIC_EXPO_PROJECT_ID:-}"
if [ -z "$project_id" ] && [ -f "$ROOT/.env" ]; then
  project_id="$(sed -n 's/^EXPO_PUBLIC_EXPO_PROJECT_ID=//p' "$ROOT/.env" | tail -1 | tr -d '"' | tr -d "'")"
fi

if [ -n "$project_id" ]; then
  echo "ok    Expo project ID: $project_id"
else
  echo "MISS  Expo project ID (set EXPO_PUBLIC_EXPO_PROJECT_ID in .env)"
  STATUS=1
fi

services_file="${GOOGLE_SERVICES_JSON:-$ROOT/google-services.json}"
if [ -f "$services_file" ]; then
  echo "ok    Firebase config: $services_file"
  if grep -q 'app.siamcreations.omnishop' "$services_file"; then
    echo "ok    Firebase config contains package app.siamcreations.omnishop"
  else
    echo "WARN  Firebase config has no client for app.siamcreations.omnishop"
    STATUS=1
  fi
else
  echo "MISS  Firebase config: $services_file"
  STATUS=1
fi

if [ "$STATUS" -ne 0 ]; then
  cat <<'EOF'

Push is not configured for this checkout. To set it up locally without EAS:
  1. Create a Firebase Android app with package app.siamcreations.omnishop.
  2. Download google-services.json into the repo root.
  3. Create an Expo project, copy its project ID into .env as
     EXPO_PUBLIC_EXPO_PROJECT_ID.
  4. Add the Firebase FCM credentials to that Expo project (website, not EAS).
  5. Rebuild with scripts/android-release.sh apk.
See docs/releasing.md, "Local push setup".
EOF
else
  echo
  echo "Local push inputs look complete. Rebuild so the native config is included."
  echo "This does not check the FCM credentials registered on the Expo project."
fi

exit 0
