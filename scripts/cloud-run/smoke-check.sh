#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?base URL required}"
base_url="${base_url%/}"
# --expect-card-index: the revision has a card search artifact pinned
# (CARD_INDEX_URI), so it only passes once /api/healthz reports
# "cardIndex":"ready" — the worker loaded the build and its self-test passed.
# A revision whose artifact failed to load would otherwise be promoted and
# serve the slow database path for its whole life.
expect_card_index=false
if [ "${2:-}" = "--expect-card-index" ]; then
  expect_card_index=true
fi
card_index_wait_seconds="${CARD_INDEX_WAIT_SECONDS:-60}"
healthz_body_file="$(mktemp "${TMPDIR:-/tmp}/kallo-healthz-body.XXXXXX")"
curl_config_file=""
cleanup() {
  rm -f "$healthz_body_file"
  # Use an if-block, not `[ -n … ] && rm`: when curl_config_file is empty (the
  # common no-secret path) the `&&` test returns non-zero as the function's last
  # command, and that status leaks out through the EXIT trap — turning a healthy
  # `exit 0` into a spurious failure.
  if [ -n "$curl_config_file" ]; then
    rm -f "$curl_config_file"
  fi
}
trap cleanup EXIT

# Deploy smoke checks hit the raw *.run.app URL directly, bypassing Cloudflare.
# When the service enforces the origin-lock (proxy.ts, prod), that request
# is missing the X-Origin-Verify header Cloudflare injects and would 403. Send
# the same shared secret here when it is available — via a 0600 curl config file
# (mktemp default perms) rather than --header, so the secret never lands in the
# process argv (/proc/<pid>/cmdline). Off-Cloudflare envs leave
# ORIGIN_SHARED_SECRET unset, so no header is added and the array only holds the
# base flags (never empty — safe under `set -u`).
curl_opts=(--silent --show-error --connect-timeout 2 --max-time 5)
if [ -n "${ORIGIN_SHARED_SECRET:-}" ]; then
  curl_config_file="$(mktemp "${TMPDIR:-/tmp}/kallo-curl-cfg.XXXXXX")"
  printf 'header = "X-Origin-Verify: %s"\n' "$ORIGIN_SHARED_SECRET" > "$curl_config_file"
  curl_opts+=(--config "$curl_config_file")
fi

check_landing_page() {
  landing_status="$(
    curl \
      "${curl_opts[@]}" \
      --output /dev/null \
      --write-out '%{http_code}' \
      "$base_url/en" 2>/dev/null || true
  )"

  [ "$landing_status" = "200" ]
}

check_card_index() {
  local deadline=$((SECONDS + card_index_wait_seconds))
  local body=""
  local status=""
  while [ "$SECONDS" -lt "$deadline" ]; do
    status="$(
      curl "${curl_opts[@]}" --output "$healthz_body_file" --write-out '%{http_code}' \
        "$base_url/api/healthz" 2>/dev/null || true
    )"
    body="$(cat "$healthz_body_file" 2>/dev/null || true)"
    # Ready only on a fully healthy answer: a 503 also names the card index.
    if [ "$status" = "200" ] && \
       echo "$body" | grep -q '"ok":true' && \
       echo "$body" | grep -q '"service":"kallo"' && \
       echo "$body" | grep -q '"cardIndex":"ready"'; then
      return 0
    fi
    # "failed" is not final yet: the app retries a failed load a few times
    # (2, 4 and 8 s apart), so a transient storage error at cold start can
    # still turn into "ready" within the wait.
    sleep 2
  done
  echo "Card search index not ready after ${card_index_wait_seconds}s: $body" >&2
  return 1
}

passed() {
  if [ "$expect_card_index" = true ] && ! check_card_index; then
    exit 1
  fi
  exit 0
}

for _ in 1 2 3 4 5; do
  health_response="$(
    curl \
      "${curl_opts[@]}" \
      --output "$healthz_body_file" \
      --write-out '%{http_code}' \
      "$base_url/api/healthz" 2>/dev/null || true
  )"

  if [ "$health_response" = "200" ]; then
    health_json="$(cat "$healthz_body_file")"
    # Explicit validation: check for required JSON fields
    if echo "$health_json" | grep -q '"ok":true' && \
       echo "$health_json" | grep -q '"service":"kallo"'; then
      if check_landing_page; then
        passed
      fi
    else
      # Health endpoint returned malformed or unhealthy response
      echo "Health check returned invalid response: $health_json" >&2
    fi
  elif [ "$health_response" = "404" ]; then
    # Legacy images may not expose /api/healthz yet; allow rollback/redeploy smoke
    # checks to fall back to the landing page during the rollout window.
    if check_landing_page; then
      passed
    fi
  fi

  sleep 2
done

echo "Smoke check failed for $base_url" >&2
exit 1
