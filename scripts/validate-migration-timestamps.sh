#!/usr/bin/env bash
# Validates that Supabase migration timestamps are in strict chronological order.
# Usage: ./scripts/validate-migration-timestamps.sh [migrations-dir]
set -euo pipefail

MIGRATIONS_DIR="${1:-supabase/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: Migrations directory '$MIGRATIONS_DIR' not found"
  exit 1
fi

files=($(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort))

if [ ${#files[@]} -eq 0 ]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

prev_ts=""
prev_file=""
errors=0

for file in "${files[@]}"; do
  basename=$(basename "$file")
  # Extract YYYYMMDDHHMMSS timestamp prefix
  ts=$(echo "$basename" | grep -oE '^[0-9]{14}' || true)

  if [ -z "$ts" ]; then
    echo "WARNING: '$basename' does not have a valid timestamp prefix"
    continue
  fi

  if [ -n "$prev_ts" ]; then
    if [ "$ts" = "$prev_ts" ]; then
      echo "ERROR: Duplicate timestamp $ts"
      echo "  - $(basename "$prev_file")"
      echo "  - $basename"
      errors=$((errors + 1))
    elif [ "$ts" \< "$prev_ts" ]; then
      echo "ERROR: Out-of-order timestamp"
      echo "  - $(basename "$prev_file") ($prev_ts)"
      echo "  - $basename ($ts) ← should be after $prev_ts"
      errors=$((errors + 1))
    fi
  fi

  prev_ts="$ts"
  prev_file="$file"
done

if [ $errors -gt 0 ]; then
  echo ""
  echo "FAILED: $errors timestamp ordering error(s) found"
  exit 1
fi

echo "OK: ${#files[@]} migrations in correct chronological order"
