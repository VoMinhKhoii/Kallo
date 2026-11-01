import { describe, expect, it } from 'vitest';
import {
  FOOD_PAGES,
  kcalSpan,
  mealKcal,
  pagesByGroup,
  relatedPages,
  sourcesOf,
} from '../pages';
import { FOOD_SLUGS, foodHubPath, foodPagePath, isFoodSlug } from '../slugs';
import type { FoodPageCapture } from '../types';

// Each ingredient is rounded on its own, so their sum can drift from the card
// total by about half a kcal per ingredient.
const roundingSlack = (count: number) => Math.ceil(count / 2);

describe.each(FOOD_SLUGS)('food page %s', (slug) => {
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
    expect(kcalSpan(capture(310, 975))).toBe('300 to 1,000');
    expect(kcalSpan(capture(400, 400))).toBe('400 to 400');
  });

  it('covers the chicken burrito page’s real meals', () => {
    expect(kcalSpan(FOOD_PAGES['chicken-burrito'].capture)).toBe(
      '300 to 1,000'
    );
  });
});

describe('the hub', () => {
  it('lists every page exactly once', () => {
    const listed = pagesByGroup().flatMap(({ pages }) =>
      pages.map((p) => p.slug)
    );
    expect([...listed].sort()).toEqual([...FOOD_SLUGS].sort());
  });

  it('relates a page to the rest of its group, never itself', () => {
    const page = FOOD_PAGES['chicken-burrito'];
    const related = relatedPages(page);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((p) => p.group === page.group)).toBe(true);
    expect(related.map((p) => p.slug)).not.toContain(page.slug);
  });
});

describe('sourcesOf', () => {
  it('names each food table the meals used, once', () => {
    expect(sourcesOf(FOOD_PAGES['chicken-burrito'].capture)).toBe(
      'USDA FoodData Central and FAO/INFOODS'
    );
  });
});

describe('slugs', () => {
  it('accepts a page and rejects anything else, inherited keys included', () => {
    expect(isFoodSlug('chicken-burrito')).toBe(true);
    expect(isFoodSlug('pho-bo')).toBe(false);
    expect(isFoodSlug('pho')).toBe(true);
    expect(isFoodSlug('toString')).toBe(false);
  });

  it('places a page under its locale and folder', () => {
    expect(foodPagePath('chicken-burrito')).toBe(
      '/en/calories/chicken-burrito'
    );
    expect(foodHubPath()).toBe('/en/calories');
  });
});
