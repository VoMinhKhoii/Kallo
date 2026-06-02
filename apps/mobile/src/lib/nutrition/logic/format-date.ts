/**
 * Vendored from web `components/nutrition/sections/editorial-header.tsx`
 * `formatDate` (keep in sync). Noon anchor avoids DST/timezone day-shift when
 * parsing a bare `YYYY-MM-DD`.
 */
export function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}
