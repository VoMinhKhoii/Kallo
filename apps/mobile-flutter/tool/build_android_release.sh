#!/usr/bin/env bash
#
# build_android_release.sh — build the signed Play App Bundle (.aab) against
# the prod backend. Upload the output in Play Console (see
# apps/docs/mobile/releasing-android.md).
#
# Prod client config mirrors ios/fastlane/Fastfile. Every value is
# client-PUBLIC; the upload key itself lives in android/key.properties
# (gitignored).
#
# Env:
#   KALLO_REVENUECAT_GOOGLE_API_KEY  goog_… SDK key (required: the paywall is
#                                    unavailable without it)
#   KALLO_POSTHOG_KEY / KALLO_SENTRY_DSN   optional; empty = analytics/crash off
#   BUILD_NUMBER                     Play versionCode; must beat the last upload
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

[[ -f android/key.properties ]] || {
  echo "android/key.properties is missing: Play rejects a debug-signed bundle." >&2
  exit 1
}

API_BASE_URL="${KALLO_API_BASE_URL:-https://kallo.fit}"
RC_KEY="${KALLO_REVENUECAT_GOOGLE_API_KEY:-}"
[[ "$RC_KEY" == goog_* ]] || {
  echo "KALLO_REVENUECAT_GOOGLE_API_KEY must be a goog_ SDK key." >&2
  exit 1
}
: "${BUILD_NUMBER:?set BUILD_NUMBER (Play versionCode, higher than the last upload)}"

flutter build appbundle --release \
  --build-number="$BUILD_NUMBER" \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=WEB_BASE_URL="${KALLO_WEB_BASE_URL:-https://kallo.fit}" \
  --dart-define=SUPABASE_URL="$API_BASE_URL/api/supabase-proxy" \
  --dart-define=SUPABASE_ANON_KEY="sb_publishable_TIrP9KQanbXTxsxJcERbLA_cI6PSNeV" \
  --dart-define=GOOGLE_WEB_CLIENT_ID="714321235532-2voptgejsba4bkm6fe440omv9q4bmbq1.apps.googleusercontent.com" \
  --dart-define=REVENUECAT_GOOGLE_API_KEY="$RC_KEY" \
  --dart-define=POSTHOG_KEY="${KALLO_POSTHOG_KEY:-}" \
  --dart-define=SENTRY_DSN="${KALLO_SENTRY_DSN:-}"

echo "Bundle: $APP_DIR/build/app/outputs/bundle/release/app-release.aab"
