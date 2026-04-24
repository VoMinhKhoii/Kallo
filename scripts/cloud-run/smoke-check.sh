#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?base URL required}"
base_url="${base_url%/}"
healthz_body_file="$(mktemp "${TMPDIR:-/tmp}/nham-healthz-body.XXXXXX")"
trap 'rm -f "$healthz_body_file"' EXIT

check_landing_page() {
  landing_status="$(
    curl \
      --silent \
      --show-error \
      --connect-timeout 2 \
      --max-time 5 \
      --output /dev/null \
      --write-out '%{http_code}' \
      "$base_url/en" 2>/dev/null || true
  )"

  [ "$landing_status" = "200" ]
}

for _ in 1 2 3 4 5; do
  health_response="$(
    curl \
      --silent \
      --show-error \
      --connect-timeout 2 \
      --max-time 5 \
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
