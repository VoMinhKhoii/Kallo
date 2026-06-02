/**
 * Pure timeline date helpers — vendored 1:1 from the web
 * (components/logging/sidebar/timeline-utils.ts), keeping only the helpers the
 * mobile date strip needs. `todayDateString` is reused from `./keys` so there is
 * a single source of truth for the local YYYY-MM-DD format.
 *
 * `Intl.DateTimeFormat` and `new Date()` are both fine in app code (Hermes ships
 * full ICU on Expo).
 */
import { todayDateString } from '../keys';

export interface WeekStrip {
  days: string[];
}

/** Converts a YYYY-MM-DD date string to a local Date object at midnight. */
export function dateStringToDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Converts a Date object to YYYY-MM-DD format using local time. */
export function dateToDateString(date: Date): string {
  return todayDateString(date);
}

export function addDays(dateStr: string, days: number): string {
  const date = dateStringToDate(dateStr);
  date.setDate(date.getDate() + days);
  return dateToDateString(date);
}

/**
 * Formats a compact chip label with weekday + month/day.
 * Example: "Sun - May 3"
 */
export function formatTimelineDayLabel(
  dateStr: string,
  locale: string
): string {
  const date = dateStringToDate(dateStr);
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
  }).format(date);
  const day = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return `${weekday} - ${day}`;
}

/**
 * Builds a 7-day strip with `anchor` placed at index 3 (the visual center), so
 * tapping the chip's old position lands on the selected date, not an adjacent
 * day.
 */
export function buildCenteredStripFromAnchor(anchor: string): WeekStrip {
  const start = addDays(anchor, -3);
  const days: string[] = [];

  for (let i = 0; i < 7; i++) {
    days.push(addDays(start, i));
  }

  return { days };
}
