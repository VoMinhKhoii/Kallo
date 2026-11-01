/**
 * The published food pages, by slug, and where they live. Kept apart from the
 * page data so the proxy can tell a real food page from a mistyped one without
 * loading any of it.
 */
export const FOOD_SLUGS = [
  'avocado-toast',
  'eggs-benedict',
  'pancakes',
  'breakfast-burrito',
  'oatmeal',
  'acai-bowl',
  'greek-yogurt-parfait',
  'french-toast',
  'bagel-with-cream-cheese',
  'full-english-breakfast',
  'chicken-shawarma',
  'cheeseburger',
  'fried-chicken-sandwich',
  'club-sandwich',
  'hot-dog',
  'gyro',
  'falafel-wrap',
  'chicken-burrito',
  'beef-tacos',
  'chicken-quesadilla',
  'nachos',
  'spaghetti-bolognese',
  'pepperoni-pizza',
  'margherita-pizza',
  'spaghetti-carbonara',
  'chicken-alfredo',
  'lasagna',
  'mac-and-cheese',
  'poke-bowl',
  'pad-thai',
  'sushi-rolls',
  'ramen',
  'pho',
  'chicken-fried-rice',
  'chicken-stir-fry',
  'bibimbap',
  'chicken-teriyaki',
  'orange-chicken',
  'chicken-tikka-masala',
  'butter-chicken',
  'thai-green-curry',
  'chili-con-carne',
  'chicken-caesar-salad',
  'greek-salad',
  'cobb-salad',
  'fish-and-chips',
  'chicken-wings',
  'fried-chicken',
  'chicken-and-rice',
  'chicken-noodle-soup',
] as const;

export type FoodSlug = (typeof FOOD_SLUGS)[number];

/** Food pages exist in this locale only. */
export const FOOD_PAGE_LOCALE = 'en';

/** The locale-relative folder every food page sits under. */
export const FOOD_PAGE_PREFIX = '/calories';

export function isFoodSlug(slug: string): slug is FoodSlug {
  return (FOOD_SLUGS as readonly string[]).includes(slug);
}

/** The page that lists every food page: `/en/calories`. */
export function foodHubPath(): string {
  return `/${FOOD_PAGE_LOCALE}${FOOD_PAGE_PREFIX}`;
}

/** A food page's path, locale included: `/en/calories/<slug>`. */
export function foodPagePath(slug: FoodSlug): string {
  return `/${FOOD_PAGE_LOCALE}${FOOD_PAGE_PREFIX}/${slug}`;
}
