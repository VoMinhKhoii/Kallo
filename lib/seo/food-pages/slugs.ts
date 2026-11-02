/**
 * The published food pages, by locale and slug, and where they live. Kept apart
 * from the page data so the proxy can tell a real food page from a mistyped one
 * without loading any of it.
 *
 * Each locale has its own dishes: the Vietnamese pages are what Vietnamese
 * searchers ask about ("phở bò bao nhiêu calo"), not translations of the
 * English ones, so a slug exists in one locale only.
 */
const EN_FOOD_SLUGS = [
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

const VI_FOOD_SLUGS = [
  'pho-bo',
  'bun-bo-hue',
  'bun-rieu',
  'hu-tieu',
  'mi-quang',
  'chao-long',
  'bun-cha',
  'bun-thit-nuong',
  'banh-cuon',
  'banh-xeo',
  'bun-dau-mam-tom',
  'com-tam-suon',
  'banh-mi-thit',
  'xoi',
  'banh-bao',
  'tra-sua-tran-chau',
  'ca-phe-sua-da',
  'thit-kho-trung',
  'ca-kho-to',
  'canh-chua',
  'rau-muong-xao-toi',
  'dau-phu-sot-ca-chua',
  'ga-rang-gung',
  'com-chien',
  'mi-goi',
] as const;

export const FOOD_SLUGS = { en: EN_FOOD_SLUGS, vi: VI_FOOD_SLUGS } as const;

/** The locales that have food pages. */
export type FoodLocale = keyof typeof FOOD_SLUGS;

export const FOOD_PAGE_LOCALES = Object.keys(FOOD_SLUGS) as FoodLocale[];

export type FoodSlugOf<L extends FoodLocale> = (typeof FOOD_SLUGS)[L][number];

export type FoodSlug = FoodSlugOf<FoodLocale>;

/** The locale-relative folder every food page sits under. */
export const FOOD_PAGE_PREFIX = '/calories';

export function isFoodLocale(locale: string): locale is FoodLocale {
  return Object.hasOwn(FOOD_SLUGS, locale);
}

export function isFoodSlug<L extends FoodLocale>(
  locale: L,
  slug: string
): slug is FoodSlugOf<L> {
  return (FOOD_SLUGS[locale] as readonly string[]).includes(slug);
}

/** The locale a slug is published in, or null for no page. */
export function foodLocaleOf(slug: string): FoodLocale | null {
  return FOOD_PAGE_LOCALES.find((locale) => isFoodSlug(locale, slug)) ?? null;
}

/** The page that lists a locale's food pages: `/en/calories`. */
export function foodHubPath(locale: FoodLocale): string {
  return `/${locale}${FOOD_PAGE_PREFIX}`;
}

/** A food page's path, locale included: `/en/calories/<slug>`. */
export function foodPagePath<L extends FoodLocale>(
  locale: L,
  slug: FoodSlugOf<L>
): string {
  return `/${locale}${FOOD_PAGE_PREFIX}/${slug}`;
}
