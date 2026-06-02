/**
 * Query-param helpers for the `/api/v1` route handlers.
 *
 * Pure, server-safe (operates on plain strings from `URLSearchParams`).
 */

/**
 * Coerce a raw `tz` query value to a number for `timezoneOffsetSchema`, WITHOUT
 * failing open. `Number(null)` and `Number('')` both evaluate to `0` — a valid
 * timezone offset — so a client that omits or blanks `tz` would otherwise get
 * UTC-bucketed day boundaries (the wrong day) instead of a 400. Returning
 * `null` for missing/empty/non-numeric input makes the schema reject it.
 */
export function parseTzParam(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}
