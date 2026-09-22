import type { MealDateSummary } from './types';

/**
 * What the timeline knows about the user's days, as four named questions.
 *
 * This replaced a bare `Map<string, number | null>` threaded through the
 * sidebar and the calendar. The Map worked, but it was read four ways and only
 * one of them was about calories — the other three asked which days exist, how
 * many there are, and whether a given day holds anything. Naming them stops a
 * caller reaching for `.get()` when it meant `.has()`.
 *
 * The distinction that matters is between the last two. `kcal()` answers "what
 * did this day come to", and `null` is a real answer: we do not know. It is
 * returned for a day whose meals carry no calorie data, for a day that also
 * holds a staged card, for a day the server's scan could not reach — and for a
 * day with nothing on it at all. `has()` is the only way to tell that last case
 * from the others, which is why it is a separate question rather than a
 * `.get(date) !== undefined` a caller has to remember to write.
 */
export interface MealDateIndex {
  /**
   * Every day holding anything, in the order the server returned (newest
   * first). The mobile strip renders straight from this, and the desktop tree
   * re-groups it.
   */
  readonly dates: readonly string[];
  /** How many days hold anything — the empty-state test. */
  readonly size: number;
  /** Does this day hold anything at all, countable or not? */
  has(date: string): boolean;
  /**
   * The day's total, or `null` when it is unknown — including when the day
   * holds nothing. Use {@link has} to tell those apart.
   */
  kcal(date: string): number | null;
}

/**
 * Builds the index once, from the server's summaries.
 *
 * One pass, one Map. Before this the shell derived a `dates` array AND a
 * `dailyKcal` Map from the same rows, the sidebar took `Array.from(keys())`
 * off the Map to feed the tree, and the mobile strip built a Set of its own —
 * four structures over one list.
 */
export function buildMealDateIndex(
  summaries: readonly MealDateSummary[]
): MealDateIndex {
  const byDate = new Map<string, number | null>(
    summaries.map((summary) => [summary.date, summary.kcal])
  );
  // From the Map rather than the input, so a duplicate date is one day here
  // too and `dates.length` cannot drift from `size`.
  const dates = Array.from(byDate.keys());

  return {
    dates,
    size: byDate.size,
    has: (date) => byDate.has(date),
    // `?? null` rather than `|| null`: a genuine 0 — logged, nothing countable
    // — is falsy, and `||` would report it as unknown. Those render
    // differently and mean different things.
    kcal: (date) => byDate.get(date) ?? null,
  };
}
