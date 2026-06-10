#!/usr/bin/env bash
#
# run_dev.sh — fire up the Flutter app on the iOS Simulator for local dev.
#
# Why the /tmp dance: this repo lives under ~/Documents (iCloud-synced), which
# stamps the Flutter framework with a `com.apple.provenance` xattr that codesign
# rejects ("resource fork, Finder information, or similar detritus not allowed")
# — even for a Simulator build. So we mirror the app to /tmp (outside iCloud)
# and run from there. Edit files in $WORK while developing (hot reload watches
# them); run `run_dev.sh back` to copy your edits home before committing.
#
# Usage:
#   ./tool/run_dev.sh          # sync app -> /tmp, boot sim, flutter run (dev config)
#   ./tool/run_dev.sh back     # sync /tmp -> repo (save edits you made in /tmp)
#
# Config (env overrides):
#   WORK            working copy dir            (default: /tmp/nham-flutter)
#   API_BASE_URL    backend for the app         (default: http://localhost:3000)
#   NHAM_ENV_FILE   path to a .env.local with the dev Supabase creds
#                   (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
#   SUPABASE_URL / SUPABASE_ANON_KEY   set these to skip .env.local lookup
#   SIM_UDID        target simulator udid       (default: a booted sim, else boot one)
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="${WORK:-/tmp/nham-flutter}"
RSYNC_EXCLUDES=(--exclude build/ --exclude .dart_tool/ --exclude .idea/ \
  --exclude ios/Pods/ --exclude ios/Flutter/ephemeral/ --exclude '*.iml')

# --- `back` mode: copy the /tmp working copy back into the repo ---------------
if [[ "${1:-}" == "back" ]]; then
  [[ -d "$WORK" ]] || { echo "No working copy at $WORK — nothing to sync back."; exit 1; }
  echo "Syncing $WORK -> $APP_DIR"
  rsync -a "${RSYNC_EXCLUDES[@]}" "$WORK/" "$APP_DIR/"
  echo "Done. Review with: git -C \"$APP_DIR\" status"
  exit 0
fi

# --- locate dev Supabase creds ------------------------------------------------
if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  ENVF="${NHAM_ENV_FILE:-}"
  if [[ -z "$ENVF" ]]; then
    # search likely .env.local locations (app-local, repo root, sibling worktrees)
    for c in \
      "$APP_DIR/.env.local" \
      "$APP_DIR"/../../.env.local \
      "$APP_DIR"/../../../../.env.local \
      "$HOME"/Documents/nham/.env.local \
      "$HOME"/Documents/nham/.claude/worktrees/*/.env.local ; do
      [[ -f "$c" ]] && { ENVF="$c"; break; }
    done
  fi
  [[ -n "$ENVF" && -f "$ENVF" ]] || {
    echo "Could not find a .env.local with dev Supabase creds."
    echo "Set NHAM_ENV_FILE=/path/to/.env.local, or export SUPABASE_URL + SUPABASE_ANON_KEY."
    exit 1
  }
  echo "Using creds from: $ENVF"
  SUPABASE_URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENVF" | head -1 | cut -d= -f2-)"
  SUPABASE_ANON_KEY="$(grep -E '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$ENVF" | head -1 | cut -d= -f2-)"
fi
[[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" ]] || { echo "Empty Supabase creds — check your .env.local."; exit 1; }
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# --- pick / boot a simulator --------------------------------------------------
open -a Simulator >/dev/null 2>&1 || true
SIM_UDID="${SIM_UDID:-$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)}"
if [[ -z "$SIM_UDID" ]]; then
  SIM_UDID="$(xcrun simctl list devices available | grep -E 'iPhone' | grep -oE '[0-9A-F-]{36}' | head -1)"
  echo "Booting simulator $SIM_UDID"
  xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
fi
[[ -n "$SIM_UDID" ]] || { echo "No iOS simulator available. Create one in Xcode first."; exit 1; }

# --- warn (non-fatal) if the backend isn't up --------------------------------
# The app boots and auth (Supabase) works without it, but every data screen
# errors until /api/v1 is reachable. Cheap heads-up so it's not a mystery.
if ! curl -fsS --max-time 2 "$API_BASE_URL/api/healthz" >/dev/null 2>&1; then
  echo "⚠  Backend not reachable at $API_BASE_URL — sign-in works, but data screens will error."
  echo "   Start it from the worktree that serves /api/v1:  bun run dev"
fi

# --- mirror to /tmp (out of iCloud) and run ----------------------------------
echo "Syncing $APP_DIR -> $WORK"
mkdir -p "$WORK"
rsync -a "${RSYNC_EXCLUDES[@]}" "$APP_DIR/" "$WORK/"
xattr -cr "$WORK" 2>/dev/null || true

cd "$WORK"
echo "Running on $SIM_UDID  (API=$API_BASE_URL)"
echo "Edit files in $WORK for hot reload; run 'tool/run_dev.sh back' to save them home."

run=(flutter run -d "$SIM_UDID"
  --dart-define=API_BASE_URL="$API_BASE_URL"
  --dart-define=SUPABASE_URL="$SUPABASE_URL"
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY")

# `flutter run` quits as soon as stdin hits EOF, and on quit it DETACHES the
# engine — leaving a debug build on-screen as a blank white/black window. That's
# fine interactively (a TTY keeps stdin open for the r/R/q keys), but when this
# script is launched headlessly (an agent, CI, `… &`, a pipe) stdin is closed and
# the app blanks seconds after launch. So: if stdin isn't a TTY, hold it open.
if [[ -t 0 ]]; then
  exec "${run[@]}"
else
  echo "(non-interactive stdin — holding it open so flutter run stays attached; see development.md → blank screen)"
  sleep 2147483647 | "${run[@]}"
fi
