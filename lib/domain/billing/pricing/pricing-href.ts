/**
 * The locale-less /pricing href (for the locale-aware router or `Link`) that
 * offers a way back to `from` — the full, locale-prefixed path the visitor is
 * on. /pricing validates it again before rendering the back link.
 */
export function pricingHref(from: string): string {
  return `/pricing?from=${encodeURIComponent(from)}`;
}
