/**
 * Field-level validators shared by every other validation module. Nothing here
 * knows about a domain — a uuid, a calendar day, a timezone offset, a feed
 * cursor. Domain schemas (meal, weight, social, chat) compose these.
 */
import { z } from 'zod';
import { dayKeyToUtcDate, toUtcDayKey } from '@/lib/core/date/day-key';

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

/** The longest trailing heatmap span: 53 week columns. */
export const MAX_HEATMAP_DAYS = 371;

/**
 * A heatmap window: `'year'` (the calendar year) or `'<N>d'`, the last N days
 * ending today, 1..[MAX_HEATMAP_DAYS]. Older clients only ever send `'30d'`,
 * `'90d'` or `'year'`, which this still accepts unchanged.
 */
export const heatmapRangeSchema = z.union([
  z.literal('year'),
  z.templateLiteral([z.number().int(), 'd']).refine((range) => {
    const days = Number.parseInt(range, 10);
    return days >= 1 && days <= MAX_HEATMAP_DAYS;
  }, `A day range must be 1 to ${MAX_HEATMAP_DAYS} days.`),
]);

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

/** Which clock a friend/group history feed is ordered and paged by. `shared`
 * is the v1 contract: installed apps group their day dividers by `sharedAt`
 * over the order they receive, so it stays the default. Clients that group by
 * `loggedAt` ask for `eaten`, so a meal logged for yesterday files under
 * Yesterday. */
export const feedOrderSchema = z.enum(['shared', 'eaten']).default('shared');
