/**
 * The empty logging day's one editorial line: a question tuned to the time of
 * day, and to the person when we know who they are.
 *
 * The buckets themselves live in `@/lib/core/date/time-of-day`; this file only
 * counts the phrasings each one carries. Kept in step with the Flutter app's
 * `empty_state.dart`, which draws from the same buckets and the same phrasings.
 */

import { bucketForHour } from '@/lib/core/date/time-of-day';

/**
 * The prompt buckets, in the order the day runs through them, with how many
 * phrasings each carries. One is drawn per visit so an empty day never feels
 * canned.
 *
 * Every phrasing ships TWICE: `<bucket><n>` (name-less) and `<bucket><n>Named`
 * (with `{name}`). The name-less form is the one that always works, so the
 * prompt can render on the very first frame — the display name arrives over the
 * network and may never arrive at all.
 */
export const EMPTY_PROMPT_BUCKETS = {
  morning: 3,
  lunch: 3,
  afternoon: 3,
  evening: 3,
  lateNight: 3,
} as const;

/**
 * A message key for the current hour, e.g. `lunch2`. Append `Named` for the
 * personalised phrasing.
 *
 * `random` is injectable so a test can pin the draw; production passes nothing
 * and gets `Math.random`.
 */
export function drawEmptyPromptKey(
  hour: number,
  random: () => number = Math.random
): string {
  const bucket = bucketForHour(hour);
  const index = Math.floor(random() * EMPTY_PROMPT_BUCKETS[bucket]) + 1;
  return `${bucket}${index}`;
}
