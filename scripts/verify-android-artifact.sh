#!/usr/bin/env bash
# Verifies built Android artifacts before they are published.
#
#   scripts/verify-android-artifact.sh <file.apk|file.aab> [...]
#
# Checks the failure modes that have actually shipped or nearly shipped:
#  - a debug-signed APK (prebuild fell back to the debug key)
#  - an APK that is not an ARM build (an emulator build reused the output path)
#  - a mislabelled package name
# It also prints the version and SHA-256 so the uploaded asset can be compared.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <file.apk|file.aab> [...]" >&2
  exit 1
fi

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

build_tools() {
  local root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [ -n "$root" ] || fail "set ANDROID_HOME or ANDROID_SDK_ROOT"
  local latest
  latest="$(ls -d "$root"/build-tools/*/ 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$latest" ] || fail "no build-tools under $root"
  echo "${latest%/}"
}

verify_apk() {
  local apk="$1"
  local bt
  bt="$(build_tools)"
  [ -x "$bt/aapt" ] || fail "aapt not found in $bt"
  [ -x "$bt/apksigner" ] || fail "apksigner not found in $bt"
  [ -f "$apk" ] || fail "APK not found: $apk"

  local badging package version_code abis signer
  badging="$("$bt/aapt" dump badging "$apk")"
  package="$(printf '%s\n' "$badging" | grep '^package:' || true)"
  [ -n "$package" ] || fail "aapt could not read $apk"
  printf '%s\n' "$package"
  printf '%s\n' "$package" | grep -q "name='app.siamcreations.omnishop'" ||
    fail "unexpected package in $apk"

  version_code="$(printf '%s\n' "$package" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")"

  abis="$(printf '%s\n' "$badging" | grep '^native-code:' || true)"
  printf '%s\n' "$abis"
  printf '%s\n' "$abis" | grep -q 'arm64-v8a' ||
    fail "APK has no arm64-v8a code: ${abis:-no native-code line}"

  signer="$("$bt/apksigner" verify --print-certs "$apk" 2>&1)"
  printf '%s\n' "$signer" | grep 'SHA-256 digest' | head -1 || true
  if printf '%s\n' "$signer" | grep -q 'CN=Android Debug'; then
    fail "APK is signed with the Android debug key"
  fi
  printf '%s\n' "$signer" | grep -q 'certificate DN:' ||
    fail "APK signature did not verify"

  echo "APK verified: versionCode=${version_code:-unknown}"
  sha256sum "$apk"
}

verify_aab() {
  local aab="$1"
  [ -f "$aab" ] || fail "AAB not found: $aab"
  if ! jarsigner -verify "$aab" >/dev/null 2>&1; then
    fail "AAB signature did not verify: $aab"
  fi
  echo "AAB signature verified"
  sha256sum "$aab"
}

for artifact in "$@"; do
  case "$artifact" in
    *.apk) verify_apk "$artifact" ;;
    *.aab) verify_aab "$artifact" ;;
    *) fail "unknown artifact type: $artifact" ;;
  esac
done
