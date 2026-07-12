/** Compact "Xm/Xh/Xd ago" — Intl handles the locale (English "1h ago" vs
 * Vietnamese "1 giờ trước") for free. Shared by the meal-wall photo-card
 * time badge and the group/friend list's last-activity subtitle. */
export function formatElapsed(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'always',
    style: 'narrow',
  });
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  );
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}
