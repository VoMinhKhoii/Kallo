/**
 * The published food pages, by slug, and where they live. Kept apart from the
 * page data so the proxy can tell a real food page from a mistyped one without
 * loading any of it.
 */
export const FOOD_SLUGS = ['chicken-burrito'] as const;

export type FoodSlug = (typeof FOOD_SLUGS)[number];

/** Food pages exist in this locale only. */
export const FOOD_PAGE_LOCALE = 'en';

/** The locale-relative folder every food page sits under. */
export const FOOD_PAGE_PREFIX = '/calories';

export function isFoodSlug(slug: string): slug is FoodSlug {
  return (FOOD_SLUGS as readonly string[]).includes(slug);
}

/** A food page's path, locale included: `/en/calories/<slug>`. */
export function foodPagePath(slug: FoodSlug): string {
  return `/${FOOD_PAGE_LOCALE}${FOOD_PAGE_PREFIX}/${slug}`;
}
