import { describe, expect, it } from 'vitest';
import { pagesOf } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_LOCALES } from '@/lib/seo/food-pages/slugs';
import { mealData } from '@/lib/seo/meal-data/facts';
import { hiddenOil } from '@/lib/seo/meal-data/stats';
import { csvField } from '../csv';
import { mealDataCsv, mealDataDownload, mealDataRows } from '../download';

describe('downloadable meal observations', () => {
  it.each(
    FOOD_PAGE_LOCALES
  )('matches every capture and page count in %s', (locale) => {
    const rows = mealDataRows().filter((row) => row.locale === locale);
    expect(rows).toHaveLength(mealData(locale).facts.meals);
    for (const page of pagesOf(locale)) {
      for (const variant of page.capture.variants) {
        const row = rows.find(
          (r) => r.dish_slug === page.slug && r.meal_key === variant.key
        );
        expect(row).toMatchObject({
          dish_name: page.name,
          description: variant.text,
          captured_at: page.capture.capturedAt,
          model_profile: page.capture.modelProfile,
          ingredients: variant.ingredients,
          dishes: variant.dishes,
          kcal: variant.dishes.reduce((n, d) => n + d.calories, 0),
          protein_g: variant.dishes.reduce((n, d) => n + d.protein, 0),
          carbs_g: variant.dishes.reduce((n, d) => n + d.carbs, 0),
          fat_g: variant.dishes.reduce((n, d) => n + d.fat, 0),
        });
        expect(row?.dish_name_en).toBeTruthy();
      }
    }
    const oil = hiddenOil(locale);
    expect(rows.filter((r) => r.added_cooking_oil)).toHaveLength(oil.withOil);
    expect(
      rows.filter((r) => r.added_cooking_oil && !r.mentioned_oil_butter_frying)
    ).toHaveLength(oil.unnamed);
  });

  it('carries metadata, reuse terms and the full observation set', () => {
    const data = mealDataDownload();
    expect(data.rows).toEqual(mealDataRows());
    expect(data.license).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(data.creator.name).toBe('Kallo');
    expect(data.dateModified).toBe(
      data.rows
        .map((r) => r.captured_at)
        .sort()
        .at(-1)
    );
    expect(data.method.length).toBeGreaterThan(0);
    expect(data.caveats.join(' ')).toContain('not user logs');
  });

  it('escapes commas, quotes and line breaks without changing description text', () => {
    expect(csvField('meal, "large"\r\nwith rice')).toBe(
      '"meal, ""large""\r\nwith rice"'
    );
    expect(csvField('phở bò')).toBe('phở bò');
    expect(csvField('one\ntwo')).toBe('"one\ntwo"');
    const rows = mealDataRows();
    const csv = mealDataCsv();
    expect(csv.startsWith(`${Object.keys(rows[0]).join(',')}\r\n`)).toBe(true);
    for (const row of rows) {
      expect(csv).toContain(
        `${Object.values(row)
          .map((value) =>
            csvField(typeof value === 'object' ? JSON.stringify(value) : value)
          )
          .join(',')}\r\n`
      );
    }
  });
});
