#!/usr/bin/env bash
set -euo pipefail

command="${1:?usage: staging-lease.sh <acquire|release>}"

: "${LEASE_BUCKET:?LEASE_BUCKET is required}"
: "${LEASE_OBJECT:?LEASE_OBJECT is required}"

lease_uri="gs://${LEASE_BUCKET}/${LEASE_OBJECT}"
lease_ttl_hours="${STAGING_LEASE_TTL_HOURS:-2}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

current_lease_file="$tmp_dir/current-lease.json"
desired_lease_file="$tmp_dir/desired-lease.json"
error_file="$tmp_dir/error.log"

append_env() {
  local key="${1:?key required}"
  local value="${2:-}"

  if [ -n "${GITHUB_ENV:-}" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$GITHUB_ENV"
  fi
}

append_summary() {
  local message="${1:?message required}"

  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '%s\n' "$message" >> "$GITHUB_STEP_SUMMARY"
  fi
}

download_current_lease() {
  rm -f "$current_lease_file" "$error_file"

  if gcloud storage cp "$lease_uri" "$current_lease_file" >/dev/null 2>"$error_file"; then
    return 0
  fi

  if grep -Eq 'No URLs matched|404' "$error_file"; then
    return 1
  fi

  cat "$error_file" >&2
  return 2
}

lease_field() {
  local field="${1:?field required}"
  jq -r "$field // \"\"" "$current_lease_file"
}

render_current_lease_message() {
  local owner branch sha started_at expires_at reason run_url
  owner="$(lease_field '.owner')"
  branch="$(lease_field '.branch')"
  sha="$(lease_field '.sha')"
  started_at="$(lease_field '.started_at')"
  expires_at="$(lease_field '.expires_at')"
  reason="$(lease_field '.reason')"
  run_url="$(lease_field '.run_url')"

  cat <<EOF
Shared staging is currently leased.
Owner: ${owner:-unknown}
Branch: ${branch:-unknown}
Commit: ${sha:-unknown}
Started at: ${started_at:-unknown}
Expires at: ${expires_at:-unknown}
Reason: ${reason:-unspecified}
Run: ${run_url:-unknown}
EOF
}

write_desired_lease() {
  local started_at expires_at run_url
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  expires_at="$(date -u -d "+${lease_ttl_hours} hours" +%Y-%m-%dT%H:%M:%SZ)"
  run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

  jq -n \
    --arg owner "${GITHUB_ACTOR:-unknown}" \
    --arg branch "${STAGING_REF:-unknown}" \
    --arg sha "${STAGING_TARGET_SHA:-unknown}" \
    --arg run_id "${GITHUB_RUN_ID:-}" \
    --arg run_url "$run_url" \
    --arg started_at "$started_at" \
    --arg expires_at "$expires_at" \
    --arg reason "${STAGING_REASON:-manual staging deploy}" \
    '{
      owner: $owner,
      branch: $branch,
      sha: $sha,
      run_id: $run_id,
      run_url: $run_url,
      started_at: $started_at,
      expires_at: $expires_at,
      reason: $reason
    }' > "$desired_lease_file"
}

describe_generation() {
  gcloud storage objects describe "$lease_uri" --format='value(generation)'
}

acquire_fresh_lease() {
  gcloud storage cp "$desired_lease_file" "$lease_uri" --if-generation-match=0 >/dev/null
  local generation
  generation="$(describe_generation)"
  append_env LEASE_GENERATION "$generation"
  append_env LEASE_URI "$lease_uri"
  append_summary "Acquired staging lease at \`$lease_uri\` (generation \`$generation\`)."
}

replace_existing_lease() {
  local expected_generation="${1:?generation required}"
  gcloud storage cp "$desired_lease_file" "$lease_uri" --if-generation-match="$expected_generation" >/dev/null
  local generation
  generation="$(describe_generation)"
  append_env LEASE_GENERATION "$generation"
  append_env LEASE_URI "$lease_uri"
  append_summary "Replaced staging lease at \`$lease_uri\` (generation \`$generation\`)."
}

acquire() {
  : "${STAGING_REF:?STAGING_REF is required}"
  : "${STAGING_REASON:?STAGING_REASON is required}"
  : "${STAGING_FORCE_TAKEOVER:?STAGING_FORCE_TAKEOVER is required}"
  : "${STAGING_TARGET_SHA:?STAGING_TARGET_SHA is required}"

  write_desired_lease

  if acquire_fresh_lease 2>"$error_file"; then
    return 0
  fi

  if ! grep -q '412' "$error_file"; then
    cat "$error_file" >&2
    exit 1
  fi

  if ! download_current_lease; then
    status=$?
    if [ "$status" -eq 1 ]; then
      echo "No existing lease found after initial acquire failed. Retrying once..." >&2
      acquire_fresh_lease
      return 0
    fi
    exit 1
  fi

  local current_generation current_expires_at now_epoch expires_epoch expired
  current_generation="$(describe_generation)"
  current_expires_at="$(lease_field '.expires_at')"
  now_epoch="$(date -u +%s)"
  expires_epoch=0

  if [ -n "$current_expires_at" ]; then
    expires_epoch="$(date -u -d "$current_expires_at" +%s 2>/dev/null || echo 0)"
  fi

  expired=false
  if [ "$expires_epoch" -gt 0 ] && [ "$expires_epoch" -le "$now_epoch" ]; then
    expired=true
  fi

  if [ "$expired" = true ] || [ "$STAGING_FORCE_TAKEOVER" = "true" ]; then
    replace_existing_lease "$current_generation"
    return 0
  fi

  render_current_lease_message >&2
  append_summary "$(render_current_lease_message)"
  exit 1
}

release() {
  local generation="${LEASE_GENERATION:-}"

  if [ -z "$generation" ]; then
    echo "No lease generation recorded; nothing to release." >&2
    exit 0
  fi

  if gcloud storage rm "$lease_uri" --if-generation-match="$generation" >/dev/null 2>"$error_file"; then
    append_summary "Released staging lease at \`$lease_uri\`."
    exit 0
  fi

  if grep -Eq 'No URLs matched|404|412' "$error_file"; then
    echo "Lease was already released or replaced; skipping cleanup." >&2
    append_summary "Skipped lease release because the lock no longer matched generation \`$generation\`."
    exit 0
  fi

  cat "$error_file" >&2
  exit 1
}

case "$command" in
  acquire)
    acquire
    ;;
  release)
    release
    ;;
  *)
    echo "Unsupported command: $command" >&2
    exit 1
    ;;
esac
