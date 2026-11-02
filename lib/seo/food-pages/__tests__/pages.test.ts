import { describe, expect, it } from 'vitest';
import { switchedFoodPath } from '@/lib/seo/food-pages/slugs';
import { FOOD_PAGE_CHROME } from '../page-copy';
import {
  FOOD_PAGES,
  kcalSpan,
  mealKcal,
  pagesByGroup,
  pagesOf,
  relatedPages,
  sourcesOf,
} from '../pages';
import {
  FOOD_PAGE_LOCALES,
  FOOD_SLUGS,
  foodHubPath,
  foodLocaleOf,
  foodPagePath,
  isFoodLocale,
  isFoodSlug,
} from '../slugs';
import { FOOD_GROUPS, type FoodPageCapture } from '../types';

// Each ingredient is rounded on its own, so their sum can drift from the card
// total by about half a kcal per ingredient.
const roundingSlack = (count: number) => Math.ceil(count / 2);

const ALL_SLUGS = FOOD_PAGE_LOCALES.flatMap((locale) => FOOD_SLUGS[locale]);

describe.each(ALL_SLUGS)('food page %s', (slug) => {
  const page = FOOD_PAGES[slug];
  const { variants } = page.capture;

  it('captured exactly the meals it lists, in order and word for word', () => {
    // A meal reworded in meals.ts without a fresh capture fails here.
    expect(variants.map((v) => [v.key, v.text])).toEqual(
      page.meals.map((m) => [m.key, m.text])
    );
    expect(variants.map((v) => v.key)).toContain(page.breakdownOf);
  });

  it('adds each meal’s ingredients up to its card total', () => {
    for (const variant of variants) {
      const sum = variant.ingredients.reduce((n, i) => n + i.kcal, 0);
      expect(
        Math.abs(sum - mealKcal(variant)),
        `${variant.key}: ingredients ${sum} vs card ${mealKcal(variant)}`
      ).toBeLessThanOrEqual(roundingSlack(variant.ingredients.length));
    }
  });

  it('sits in one of its own locale’s hub groups', () => {
    expect(Object.keys(FOOD_GROUPS[page.locale])).toContain(page.group);
  });

  it('names its food tables in its own language', () => {
    const other = page.locale === 'vi' ? 'National Institute' : 'Viện';
    expect(sourcesOf(page)).not.toContain(other);
  });
});

describe('kcalSpan', () => {
  const capture = (...kcals: number[]): FoodPageCapture => ({
    capturedAt: '2026-10-31T00:00:00Z',
    modelProfile: 'haiku',
    variants: kcals.map((calories, i) => ({
      key: `m${i}`,
      text: '',
      ingredients: [],
      dishes: [{ name: 'dish', calories, protein: 0, carbs: 0, fat: 0 }],
    })),
  });

  it('rounds the meals out to whole hundreds', () => {
    expect(kcalSpan(capture(310, 975), 'en')).toBe('300 to 1,000');
    expect(kcalSpan(capture(400, 400), 'en')).toBe('400 to 400');
    // A meal under 100 kcal must not read as "0 to …".
    expect(kcalSpan(capture(72, 457), 'en')).toBe('70 to 500');
  });

  it('writes the span the way the page’s language does', () => {
    expect(kcalSpan(capture(310, 975), 'vi')).toBe('300 đến 1.000');
  });

  it('covers the chicken burrito page’s real meals', () => {
    expect(kcalSpan(FOOD_PAGES['chicken-burrito'].capture, 'en')).toBe(
      '300 to 1,000'
    );
  });
});

describe.each(FOOD_PAGE_LOCALES)('the %s hub', (locale) => {
  it('lists each of its pages exactly once, and no other locale’s', () => {
    const listed = pagesByGroup(locale).flatMap(({ pages }) =>
      pages.map((p) => p.slug)
    );
    expect([...listed].sort()).toEqual([...FOOD_SLUGS[locale]].sort());
  });

  it('relates a page to the rest of its group, never itself', () => {
    for (const page of pagesOf(locale)) {
      const related = relatedPages(page);
      expect(related.length, page.slug).toBeGreaterThan(0);
      expect(related.every((p) => p.group === page.group)).toBe(true);
      expect(related.every((p) => p.locale === locale)).toBe(true);
      expect(related.map((p) => p.slug)).not.toContain(page.slug);
    }
  });
});

describe('sourcesOf', () => {
  it('names each food table the meals used, once', () => {
    expect(sourcesOf(FOOD_PAGES['chicken-burrito'])).toBe(
      'USDA FoodData Central and FAO/INFOODS'
    );
  });
});

describe('slugs', () => {
  it('accepts a page in its own locale and rejects anything else', () => {
    expect(isFoodSlug('en', 'chicken-burrito')).toBe(true);
    expect(isFoodSlug('en', 'pho')).toBe(true);
    expect(isFoodSlug('en', 'pho-bo')).toBe(false);
    expect(isFoodSlug('vi', 'pho-bo')).toBe(true);
    expect(isFoodSlug('vi', 'pho')).toBe(false);
    expect(isFoodSlug('en', 'toString')).toBe(false);
    expect(isFoodLocale('vi')).toBe(true);
    expect(isFoodLocale('toString')).toBe(false);
  });

  it('gives every slug one locale', () => {
    expect(new Set(ALL_SLUGS).size).toBe(ALL_SLUGS.length);
    expect(foodLocaleOf('pho')).toBe('en');
    expect(foodLocaleOf('pho-bo')).toBe('vi');
    expect(foodLocaleOf('nope')).toBeNull();
  });

  it('places a page under its locale and folder', () => {
    expect(foodPagePath('en', 'chicken-burrito')).toBe(
      '/en/calories/chicken-burrito'
    );
    expect(foodPagePath('vi', 'com-tam-suon')).toBe(
      '/vi/calories/com-tam-suon'
    );
    expect(foodHubPath('en')).toBe('/en/calories');
    expect(foodHubPath('vi')).toBe('/vi/calories');
  });
});

/**
 * The English pages as they shipped before Vietnamese existed (#514): their
 * slugs, order and the words around them must not move.
 */
describe('the English pages stay as published', () => {
  it('keeps the 50 slugs in their order', () => {
    expect(FOOD_SLUGS.en).toHaveLength(50);
    expect(FOOD_SLUGS.en.slice(0, 3)).toEqual([
      'avocado-toast',
      'eggs-benedict',
      'pancakes',
    ]);
    expect(FOOD_SLUGS.en.at(-1)).toBe('chicken-noodle-soup');
  });

  it('keeps the hub and page wording', () => {
    const en = FOOD_PAGE_CHROME.en;
    expect(en.hub.title(50)).toBe(
      'Calories in 50 Everyday Meals, Logged for Real'
    );
    expect(en.hub.description(50)).toBe(
      'How many calories are in a burrito, a poke bowl or pad thai? 50 everyday meals, each logged in Kallo four ways, with the ingredients that move the number.'
    );
    expect(en.hub.heading).toBe('Calories in everyday meals');
    expect(en.formatDate(new Date('2026-11-01T06:22:00.877Z'))).toBe(
      'November 1, 2026'
    );
    expect(en.loggedOn('November 1, 2026')).toBe(
      'Logged in Kallo on November 1, 2026'
    );
    expect(en.sourcesBody('November 1, 2026', 'USDA FoodData Central')).toBe(
      'Each meal above was typed into Kallo once, on November 1, 2026. Kallo split it into ingredients, estimated the grams, and took calories and macros from USDA FoodData Central.'
    );
    expect(`${en.browse.before}${en.browse.link(50)}${en.browse.after}`).toBe(
      'Or browse all 50 meals.'
    );
    expect([en.movesHeading, en.sourcesHeading, en.moreHeading]).toEqual([
      'What moves the number',
      'Where these numbers come from',
      'More meals',
    ]);
    expect(en.footerLink).toBe('Calories in meals');
  });

  it('keeps its groups and their order', () => {
    expect(Object.values(FOOD_GROUPS.en)).toEqual([
      'Breakfast',
      'Burgers, sandwiches and wraps',
      'Mexican',
      'Pizza and pasta',
      'Asian',
      'Curries and chili',
      'Salads',
      'Chicken and comfort food',
    ]);
  });
});

describe('switchedFoodPath', () => {
  it("sends a dish with no twin to the other locale's hub", () => {
    expect(switchedFoodPath('/calories/pho-bo', 'en')).toBe('/calories');
    expect(switchedFoodPath('/calories/pad-thai', 'vi')).toBe('/calories');
  });

  it('keeps every other path, including the hubs and non-food pages', () => {
    expect(switchedFoodPath('/calories', 'vi')).toBe('/calories');
    expect(switchedFoodPath('/tools/bmi-calculator', 'vi')).toBe(
      '/tools/bmi-calculator'
    );
    expect(switchedFoodPath('/docs/overview', 'en')).toBe('/docs/overview');
  });
});
