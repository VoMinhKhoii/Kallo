import { shiftDayKey } from '@/lib/core/date/day-key';

/**
 * Wall-clock reads in a named IANA zone — the server-side counterpart of the
 * per-request `timezoneOffset` the clients send. A fixed offset cannot say
 * what the clock reads tomorrow across a DST change; a zone can, so anything
 * the server does on the user's clock without a request in hand (the reminder
 * tick) goes through here.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True for a zone this runtime can resolve (`Asia/Ho_Chi_Minh`, `UTC`). */
export function isValidTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export interface ZonedClock {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Minutes since local midnight, 0–1439. */
  minuteOfDay: number;
}

function parts(instant: Date, timeZone: string) {
  const values: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return values;
}

/** What the clock on the wall reads in `timeZone` at `instant`. */
export function zonedClock(instant: Date, timeZone: string): ZonedClock {
  const p = parts(instant, timeZone);
  const date = `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return { date, minuteOfDay: p.hour * 60 + p.minute };
}

/** The zone's offset from UTC at `instant`, in ms (east positive). */
function offsetMs(instant: Date, timeZone: string): number {
  const p = parts(instant, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** The UTC instant at which local `date` begins in `timeZone`. */
function startOfZonedDay(date: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const wallMidnight = Date.UTC(year, month - 1, day);
  // Two passes: the first guess uses the offset at UTC midnight, which can sit
  // on the other side of a DST change from local midnight.
  let start = wallMidnight - offsetMs(new Date(wallMidnight), timeZone);
  start = wallMidnight - offsetMs(new Date(start), timeZone);
  // Where a DST change skips midnight itself (Santiago, Havana: 23:59 → 01:00)
  // no instant reads 00:00, and the passes above land in the day before. The
  // day then starts at its first instant: step forward to it. Every offset in
  // use is a whole number of quarter hours, and no change exceeds 2 h.
  for (
    let i = 0;
    i < 12 && zonedClock(new Date(start), timeZone).date < date;
    i++
  ) {
    start += QUARTER_HOUR_MS;
  }
  return new Date(start);
}

/** `[start, end)` in UTC for local `date` in `timeZone` — 23, 24 or 25 h. */
export function zonedDayRange(
  date: string,
  timeZone: string
): { dayStart: Date; dayEnd: Date } {
  return {
    dayStart: startOfZonedDay(date, timeZone),
    dayEnd: startOfZonedDay(shiftDayKey(date, 1), timeZone),
  };
}
