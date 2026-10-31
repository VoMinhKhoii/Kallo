import { describe, expect, it } from 'vitest';
import { FOOD_PAGES, FOOD_SLUGS, isFoodSlug } from '../pages';

// Each ingredient and the total are rounded on their own, so a sum can be off
// by about half a kcal per ingredient.
const roundingSlack = (count: number) => Math.ceil(count / 2);

describe.each(FOOD_SLUGS)('food page %s', (slug) => {
  const page = FOOD_PAGES[slug];
  const { variants } = page.capture;

  it('labels every meal it shows', () => {
    for (const variant of variants) {
      expect(page.labels[variant.key], variant.key).toBeTruthy();
    }
    expect(variants.map((v) => v.key)).toContain(page.breakdownOf);
  });

  it('adds each meal’s ingredients up to its total', () => {
    for (const variant of variants) {
      const sum = variant.ingredients.reduce((n, i) => n + i.kcal, 0);
      expect(
        Math.abs(sum - variant.kcal.mid),
        `${variant.key}: ingredients ${sum} vs total ${variant.kcal.mid}`
      ).toBeLessThanOrEqual(roundingSlack(variant.ingredients.length));
    }
  });

  it('shows card rows that add up to the same total', () => {
    for (const variant of variants) {
      const rows = variant.dishes.reduce((n, d) => n + d.calories, 0);
      expect(Math.abs(rows - variant.kcal.mid), variant.key).toBeLessThan(1);
    }
  });

  it('keeps each total inside its own range', () => {
    for (const { key, kcal } of variants) {
      expect(kcal.low, key).toBeLessThanOrEqual(kcal.mid);
      expect(kcal.mid, key).toBeLessThanOrEqual(kcal.high);
    }
  });
});

describe('isFoodSlug', () => {
  it('accepts a page and rejects anything else, inherited keys included', () => {
    expect(isFoodSlug('chicken-burrito')).toBe(true);
    expect(isFoodSlug('pho-bo')).toBe(false);
    expect(isFoodSlug('toString')).toBe(false);
  });
});
