/**
 * Day keys: the `YYYY-MM-DD` calendar day a moment belongs to, and the
 * conversions between that key and a UTC instant.
 *
 * `timezoneOffset` everywhere in this file is minutes in
 * `Date.getTimezoneOffset()` sign — INVERTED from the UTC offset, so UTC+7 is
 * -420 and UTC-5 is +300. `timezoneOffsetSchema` in
 * `@/lib/core/validation/primitives` is the authority on the -840..720 range.
 *
 * Nothing here reads a zone database. The caller supplies the offset that was
 * in force at the instant it cares about, and the shift is exactly that
 * offset — so a client crossing a DST boundary must send the right one.
 */

const MS_PER_MINUTE = 60_000;

function toEpochMs(instant: Date | number): number {
  return typeof instant === 'number' ? instant : instant.getTime();
}

/** The UTC calendar day an instant falls on. */
export function toUtcDayKey(instant: Date | number): string {
  return new Date(instant).toISOString().slice(0, 10);
}

/**
 * The instant shifted so its UTC fields read as the viewer's wall clock. The
 * result is no longer the moment it came from — only `getUTC*`/`toISOString`
 * parts are meaningful. Reach for this when day arithmetic has to run in the
 * viewer's calendar; when you only want the day, use `toLocalDayKey`.
 */
export function toLocalCalendarDate(
  instant: Date | number,
  timezoneOffset: number
): Date {
  return new Date(toEpochMs(instant) - timezoneOffset * MS_PER_MINUTE);
}

/** The viewer's calendar day an instant falls on. */
export function toLocalDayKey(
  instant: Date | number,
  timezoneOffset: number
): string {
  return toUtcDayKey(toLocalCalendarDate(instant, timezoneOffset));
}

/** A day key read as UTC midnight — the anchor day arithmetic runs on. */
export function dayKeyToUtcDate(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00.000Z`);
}
