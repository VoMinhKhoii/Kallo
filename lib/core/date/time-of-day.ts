/**
 * Which part of the day an hour belongs to.
 *
 * One table, two readers: the empty-day composer prompt picks its phrasing
 * from it, and the surface-state illustrations swap to a sleeping pose after
 * dark. Kept in step with the Flutter app's `lib/shared/logic/time_of_day.dart`,
 * which carries the same boundaries.
 */

export type TimeOfDayBucket =
  | 'morning'
  | 'lunch'
  | 'afternoon'
  | 'evening'
  | 'lateNight';

/**
 * Which bucket `hour` (0–23) falls in. Late night is the wrap-around case:
 * everything from 22:00 until breakfast starts.
 */
export function bucketForHour(hour: number): TimeOfDayBucket {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'lateNight';
}

/** Whether `hour` sits in the 22:00–05:00 stretch. */
export function isLateNight(hour: number): boolean {
  return bucketForHour(hour) === 'lateNight';
}
