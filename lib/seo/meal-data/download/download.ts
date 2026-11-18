import { mealKcal, pagesOf } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_LOCALES, type FoodSlugOf } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_LICENSE } from '@/lib/seo/meal-data/path';
import { mealOil } from '@/lib/seo/meal-data/stats';
import { SITE_URL } from '@/lib/seo/site';
import { csvField } from './csv';
import { ENGLISH_NAMES } from './english-names';

/** One observation per captured meal, across both independent page sets. */
export function mealDataRows() {
  return FOOD_PAGE_LOCALES.flatMap((locale) =>
    pagesOf(locale).flatMap((page) =>
      page.capture.variants.map((variant) => {
        const oil = mealOil(locale, variant);
        return {
          dish_slug: page.slug,
          dish_name_en:
            locale === 'en'
              ? page.name
              : ENGLISH_NAMES[page.slug as FoodSlugOf<'vi'>],
          dish_name: page.name,
          locale,
          meal_key: variant.key,
          description: variant.text,
          kcal: mealKcal(variant),
          protein_g: variant.dishes.reduce((n, d) => n + d.protein, 0),
          carbs_g: variant.dishes.reduce((n, d) => n + d.carbs, 0),
          fat_g: variant.dishes.reduce((n, d) => n + d.fat, 0),
          added_cooking_oil: oil.added,
          mentioned_oil_butter_frying: oil.mentioned,
          cooking_oil_kcal: oil.kcal,
          captured_at: page.capture.capturedAt,
          model_profile: page.capture.modelProfile,
          ingredients: variant.ingredients,
          dishes: variant.dishes,
        };
      })
    )
  );
}

export function mealDataDownload() {
  const rows = mealDataRows();
  return {
    title: 'Meal calorie variation in Kallo',
    description:
      'Kallo estimates for meal descriptions we wrote, from the English and Vietnamese food-page sets.',
    license: MEAL_DATA_LICENSE,
    creator: { name: 'Kallo', url: SITE_URL },
    dateModified: rows
      .map((row) => row.captured_at)
      .sort()
      .at(-1),
    method: [
      'Each description was entered into Kallo once. The pipeline split it into ingredients, estimated grams and looked up food-composition data.',
      'Meal kcal and macros are sums of captured dish rows. Ingredient kcal can differ from dish totals. Cooking oil flags and kcal use the same ingredient-name classification and description checks as the analysis page.',
      'For each locale, compare the maximum and minimum meal kcal per dish. The page reports the median of these ratios rounded to one decimal. Ingredient statistics use captured ingredient rows.',
      'Filter rows by locale to reproduce that page set. English and Vietnamese page sets contain different dishes.',
      'The ingredients and dishes columns preserve each captured breakdown. In CSV these columns contain JSON arrays; in JSON they are arrays. Ingredient grams, kcal and food-table sources are retained.',
    ],
    caveats: [
      'These are estimates, not measurements of food and not user logs. Descriptions were written to cover common portions, not randomly sampled.',
      'Captures contain point estimates, not low/high uncertainty bounds. The model profile and capture timestamp are included per row.',
      'Added cooking oil means Kallo counted a separate oil or fat ingredient with nonzero kcal, whether or not the description named it. Mention flags reproduce the page checks; they do not determine whether the person ate oil.',
      'Reuse with credit to Kallo under CC BY 4.0.',
    ],
    rows,
  };
}

export function mealDataCsv(): string {
  const rows = mealDataRows();
  return `${[
    Object.keys(rows[0]).map(csvField).join(','),
    ...rows.map((row) =>
      Object.values(row)
        .map((value) =>
          csvField(typeof value === 'object' ? JSON.stringify(value) : value)
        )
        .join(',')
    ),
  ].join('\r\n')}\r\n`;
}
