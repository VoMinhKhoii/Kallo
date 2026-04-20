#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?base URL required}"
base_url="${base_url%/}"

for _ in 1 2 3 4 5; do
  if health_json="$(curl --fail --silent --show-error "$base_url/api/healthz")"; then
    echo "$health_json" | grep -q '"ok":true'
    echo "$health_json" | grep -q '"service":"nham"'

    landing_status="$(
      curl \
        --fail \
        --silent \
        --show-error \
        --output /dev/null \
        --write-out '%{http_code}' \
        "$base_url/en"
    )"

    if [ "$landing_status" = "200" ]; then
      exit 0
    fi
  fi

  sleep 2
done

echo "Smoke check failed for $base_url" >&2
exit 1
