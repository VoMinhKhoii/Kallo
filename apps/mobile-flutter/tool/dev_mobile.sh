#!/usr/bin/env bash
#
# dev_mobile.sh — one command for the full mobile dev stack.
#
# Brings up everything the Flutter app needs and tears it down together:
#   1. the /api/v1 Next.js backend on :3000  (background; skipped if already up)
#   2. the Flutter app on the iOS Simulator   (foreground, via run_dev.sh)
#
# Ctrl-C (or quitting flutter run) stops the app AND the backend it started.
# Run it via the root script:  bun dev:mobile
#
# Env overrides are passed straight through to run_dev.sh (API_BASE_URL,
# SIM_UDID, NHAM_ENV_FILE, SUPABASE_URL/ANON_KEY — see development.md).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$APP_DIR/../.." && pwd)"   # repo root (holds package.json + /api/v1)
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

health() { curl -fsS --max-time 2 "$API_BASE_URL/api/healthz" >/dev/null 2>&1; }

# --- 1. backend --------------------------------------------------------------
BACKEND_PID=""
if health; then
  echo "✓ Backend already up at $API_BASE_URL — reusing it."
else
  echo "▶ Starting backend (bun run dev) from $ROOT …"
  ( cd "$ROOT" && exec bun run dev ) &
  BACKEND_PID=$!
fi

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    echo ""
    echo "■ Stopping backend (pid $BACKEND_PID) …"
    pkill -P "$BACKEND_PID" 2>/dev/null || true   # next dev (child of bun)
    kill "$BACKEND_PID" 2>/dev/null || true       # bun
  fi
}
trap cleanup EXIT INT TERM

# Wait for the backend to answer before launching the app (up to ~60s).
if [[ -n "$BACKEND_PID" ]]; then
  printf "  waiting for %s/api/healthz " "$API_BASE_URL"
  for _ in $(seq 1 60); do
    if health; then echo " ✓ ready"; break; fi
    printf "."
    sleep 1
  done
  health || echo " (still not answering — launching anyway; data screens may error)"
fi

# --- 2. app (foreground; run_dev.sh holds the session) -----------------------
# Not exec'd, so the EXIT trap fires and the backend is torn down when the app
# session ends. run_dev.sh inherits this stdin: a TTY → interactive hot-reload
# keys; non-TTY → it auto-holds stdin open so flutter run stays attached.
"$APP_DIR/tool/run_dev.sh"
