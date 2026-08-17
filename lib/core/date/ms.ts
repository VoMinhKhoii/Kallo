/** A nominal calendar day in milliseconds. Nominal because it ignores DST —
 *  it is the span used for day-key arithmetic over UTC-anchored midnights,
 *  where every day is exactly 24 hours. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
