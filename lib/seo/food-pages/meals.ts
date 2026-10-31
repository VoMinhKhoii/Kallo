import type { FoodSlug } from './slugs';

/**
 * The meals each food page shows, in order: the heading the reader sees and
 * the sentence typed into Kallo. `scripts/seo/capture-food-page.ts` captures
 * exactly these texts, and a test fails when a page's capture no longer
 * matches them.
 *
 * Write them the way people log: parts, amounts and what was left out ("no
 * rice, a bit of cheese"). A bare "1 chicken burrito" shows nothing Kallo does
 * that a lookup table does not.
 */
export interface FoodPageMeal {
  key: string;
  label: string;
  text: string;
}

export const FOOD_PAGE_MEALS: Record<FoodSlug, FoodPageMeal[]> = {
  'chicken-burrito': [
    {
      key: 'shop',
      label: 'Burrito shop, everything in it',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + cheese + sour cream + guacamole)',
    },
    {
      key: 'shop-lighter',
      label: 'Burrito shop, no cheese or sour cream',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + salsa, no cheese, no sour cream)',
    },
    {
      key: 'bowl-no-rice',
      label: 'Burrito bowl, no rice',
      text: 'Chicken burrito bowl (1 tortilla + 1 scoop of grilled chicken + salad and pineapple + a bit of cheese, no rice)',
    },
    {
      key: 'homemade',
      label: 'Homemade, small tortilla',
      text: 'Homemade chicken burrito (1 small flour tortilla + 100g grilled chicken breast + lettuce + salsa + a bit of cheese)',
    },
  ],
};
