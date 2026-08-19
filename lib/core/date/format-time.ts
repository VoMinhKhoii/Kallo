/** Zero-padded hour:minute clock label in the viewer's zone — "14:30" in
 *  Vietnamese, "02:30 PM" in US English. Intl picks the clock; the meal-feed
 *  cards all show the same one. */
export function formatTime(value: Date | string | number, locale: string) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}
