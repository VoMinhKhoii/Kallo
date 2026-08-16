/**
 * Field-level validators shared by every other validation module. Nothing here
 * knows about a domain — a uuid, a calendar day, a timezone offset, a feed
 * cursor. Domain schemas (meal, weight, social, chat) compose these.
 */
import { z } from 'zod';
import { dayKeyToUtcDate, toUtcDayKey } from '@/lib/date/day-key';

export function isValidCalendarDateString(value: string): boolean {
  const date = dayKeyToUtcDate(value);
  // Guard first: toISOString throws on an Invalid Date.
  return Number.isFinite(date.getTime()) && toUtcDayKey(date) === value;
}

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.')
  .refine(isValidCalendarDateString, 'Ngày không hợp lệ.');

/**
 * Minutes offset from UTC in `Date.getTimezoneOffset()` sign (inverted: UTC+7
 * is -420). Real UTC offsets span -12:00..+14:00, so the valid range is
 * -840..720. This is the ONLY definition — never re-declare the bounds inline.
 */
export const timezoneOffsetSchema = z.number().int().min(-840).max(720);

/**
 * Any uuid accepted at an API boundary, lowercased after validating.
 *
 * Postgres compares uuids case-insensitively, but the JS canonical-pair
 * ordering (lib/groups/friendship.ts orderedPair) sorts lexicographically, so
 * an uppercase-hex id would order differently than the stored lowercase row.
 * Normalising here keeps both authorities in agreement.
 */
export const uuidSchema = z.string().uuid('Phải là UUID hợp lệ.').toLowerCase();

/** Opaque tuple cursor shared by the friend/group history feeds. A plain ISO
 * timestamp remains valid for legacy Flutter clients. */
export const beforeCursorSchema = z.string().trim().min(1).max(500).optional();
