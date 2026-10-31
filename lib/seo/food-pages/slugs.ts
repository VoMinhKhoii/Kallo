/**
 * The published food pages, by slug. Kept apart from `pages.ts` so the proxy
 * can tell a real food page from a mistyped one without loading any page data;
 * `pages.ts` is typed against this list, so the two cannot drift.
 */
export const FOOD_SLUGS = ['chicken-burrito'] as const;

export type FoodSlug = (typeof FOOD_SLUGS)[number];

/** Food pages exist in this locale only. */
export const FOOD_PAGE_LOCALE = 'en';

export function isFoodSlug(slug: string): slug is FoodSlug {
  return (FOOD_SLUGS as readonly string[]).includes(slug);
}
