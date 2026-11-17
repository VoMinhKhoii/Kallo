/**
 * The head-to-head "Kallo vs <app>" pages, by slug, and where they live. Kept
 * apart from their copy so the proxy can tell a real page from a mistyped one
 * without loading any of it. English only, like the alternatives pages.
 */
export const COMPARE_SLUGS = [
  'kallo-vs-cal-ai',
  'kallo-vs-myfitnesspal',
] as const;

export type CompareSlug = (typeof COMPARE_SLUGS)[number];

/** The only locale with comparison pages. */
export const COMPARE_LOCALE = 'en';

/** The locale-relative folder every comparison page sits under. */
export const COMPARE_PREFIX = '/compare';

export function isCompareSlug(slug: string): slug is CompareSlug {
  return (COMPARE_SLUGS as readonly string[]).includes(slug);
}

/** A comparison page's path without the locale: `/compare/<slug>`. */
export function comparePath(slug: CompareSlug): string {
  return `${COMPARE_PREFIX}/${slug}`;
}
