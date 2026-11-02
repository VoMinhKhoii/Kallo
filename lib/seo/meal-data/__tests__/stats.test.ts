import { describe, expect, it } from 'vitest';
import { FOOD_PAGE_LOCALES } from '@/lib/seo/food-pages/slugs';
import { MEAL_DATA_COPY } from '@/lib/seo/meal-data/copy';
import {
  hiddenOil,
  ingredientStats,
  kindOf,
  mealSwings,
  median,
} from '@/lib/seo/meal-data/stats';

describe('median', () => {
  it('takes the middle value, averaging the two middles of an even list', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(3);
  });
});

describe('kindOf', () => {
  it('puts noodles before rice and sauces before oil', () => {
    expect(kindOf('en', 'Rice noodles')).toBe('noodles');
    expect(kindOf('en', 'White rice')).toBe('rice');
    expect(kindOf('vi', 'Mì gói')).toBe('noodles');
    expect(kindOf('vi', 'Dầu hào')).toBe('sauce');
    expect(kindOf('vi', 'Dầu ăn')).toBe('oil');
  });

  it('matches Vietnamese names as whole words', () => {
    expect(kindOf('vi', 'Chả miếng')).toBeNull();
    expect(kindOf('vi', 'Miến gà')).toBe('noodles');
    expect(kindOf('vi', 'Bánh mì')).toBe('bread');
    expect(kindOf('vi', 'Ổ bánh mì')).toBe('bread');
    expect(kindOf('vi', 'Bánh phở')).toBe('noodles');
    expect(kindOf('vi', 'Cơm trắng')).toBe('rice');
  });

  it('reads the Vietnamese oil names English captures carry', () => {
    expect(kindOf('en', 'Dầu ăn')).toBe('oil');
    expect(kindOf('en', 'Olive oil')).toBe('oil');
    expect(kindOf('en', 'Boiled egg')).toBeNull();
    expect(kindOf('en', 'Peanut butter')).toBeNull();
  });

  it('keeps coatings, soups, chips and vegetable swaps out of their look-alikes', () => {
    expect(kindOf('en', 'Breaded chicken breast')).toBeNull();
    expect(kindOf('en', 'Tortilla chips')).toBeNull();
    expect(kindOf('en', 'Chicken noodle soup')).toBeNull();
    expect(kindOf('en', 'Zucchini noodles')).toBeNull();
    expect(kindOf('en', 'Cauliflower rice')).toBeNull();
    expect(kindOf('en', 'Cheeseburger patty')).toBeNull();
    expect(kindOf('vi', 'Bột gạo')).toBeNull();
    expect(kindOf('en', 'Sourdough bread')).toBe('bread');
  });
});

describe.each(FOOD_PAGE_LOCALES)('meal data, %s', (locale) => {
  it('has one swing per dish, biggest first, each from its own meals', () => {
    const swings = mealSwings(locale);
    expect(swings.length).toBeGreaterThan(0);
    for (let i = 1; i < swings.length; i++)
      expect(swings[i - 1].ratio).toBeGreaterThanOrEqual(swings[i].ratio);
    for (const s of swings) {
      expect(s.page.locale).toBe(locale);
      expect(s.high).toBeGreaterThanOrEqual(s.low);
      expect(s.lowLabel).not.toBe('');
    }
  });

  it('counts hidden oil within the meals it read', () => {
    const oil = hiddenOil(locale);
    expect(oil.unnamed).toBeLessThanOrEqual(oil.withOil);
    expect(oil.withOil).toBeLessThanOrEqual(oil.total);
    expect(oil.total).toBe(
      mealSwings(locale).reduce((n, s) => n + s.page.capture.variants.length, 0)
    );
  });

  it('labels every ingredient kind it reports', () => {
    for (const kind of ingredientStats(locale)) {
      expect(MEAL_DATA_COPY[locale].kinds[kind.key]).toBeTruthy();
      expect(kind.meals).toBeGreaterThan(0);
      expect(kind.maxKcal).toBeGreaterThanOrEqual(kind.medianKcal);
    }
  });
});
