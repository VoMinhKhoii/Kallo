/**
 * The "alternatives to <app>" pages, by slug, and where they live. Kept apart
 * from their copy so the proxy can tell a real page from a mistyped one without
 * loading any of it. English only: the queries these answer are English ones
 * ("cal ai alternatives"); a Vietnamese reader searches for apps differently.
 */
export const ALTERNATIVE_SLUGS = ['cal-ai', 'myfitnesspal'] as const;

export type AlternativeSlug = (typeof ALTERNATIVE_SLUGS)[number];

/** The only locale with alternatives pages. */
export const ALTERNATIVES_LOCALE = 'en';

/** The locale-relative folder every alternatives page sits under. */
export const ALTERNATIVES_PREFIX = '/alternatives';

export function isAlternativeSlug(slug: string): slug is AlternativeSlug {
  return (ALTERNATIVE_SLUGS as readonly string[]).includes(slug);
}

/** An alternatives page's path without the locale: `/alternatives/<slug>`. */
export function alternativePath(slug: AlternativeSlug): string {
  return `${ALTERNATIVES_PREFIX}/${slug}`;
}
