#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?base URL required}"
base_url="${base_url%/}"
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
# When the service enforces the origin-lock (middleware.ts, prod), that request
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
       echo "$health_json" | grep -q '"service":"nham"'; then
      if check_landing_page; then
        exit 0
      fi
    else
      # Health endpoint returned malformed or unhealthy response
      echo "Health check returned invalid response: $health_json" >&2
    fi
  elif [ "$health_response" = "404" ]; then
    # Legacy images may not expose /api/healthz yet; allow rollback/redeploy smoke
    # checks to fall back to the landing page during the rollout window.
    if check_landing_page; then
      exit 0
    fi
  fi

  sleep 2
done

echo "Smoke check failed for $base_url" >&2
exit 1
