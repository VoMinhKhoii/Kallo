import { describe, expect, it } from 'vitest';
import { FOOD_PAGE_MEALS } from '../meals';
import {
  FOOD_PAGES,
  type FoodPageCapture,
  kcalSpan,
  mealKcal,
  sourcesOf,
} from '../pages';
import { FOOD_SLUGS, foodPagePath, isFoodSlug } from '../slugs';

// Each ingredient is rounded on its own, so their sum can drift from the card
// total by about half a kcal per ingredient.
const roundingSlack = (count: number) => Math.ceil(count / 2);

describe.each(FOOD_SLUGS)('food page %s', (slug) => {
  const page = FOOD_PAGES[slug];
  const { variants } = page.capture;

  it('captured exactly the meals it lists, in order and word for word', () => {
    // A meal reworded in meals.ts without a fresh capture fails here.
    expect(variants.map((v) => [v.key, v.text])).toEqual(
      FOOD_PAGE_MEALS[slug].map((m) => [m.key, m.text])
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
    expect(isFoodSlug('toString')).toBe(false);
  });

  it('places a page under its locale and folder', () => {
    expect(foodPagePath('chicken-burrito')).toBe(
      '/en/calories/chicken-burrito'
    );
  });
});
