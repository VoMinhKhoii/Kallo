/**
 * Locale-aware number formatter used across the nutrition surfaces. Drops
 * fraction digits at >=100 to keep large grams and mg values compact, otherwise
 * shows a single decimal so e.g. 0.5g stays meaningful.
 *
 * Lives here rather than beside the nutrition cards because the shared macro
 * scale draws the same figures on the dashboard, the logging feed and the
 * Circle feed, and a shared primitive must not reach into a feature folder for
 * its formatter.
 *
 * Flutter counterpart: `formatCount` in `shared/logic/display_format.dart`.
 */
export function formatLocalizedNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value);
}
