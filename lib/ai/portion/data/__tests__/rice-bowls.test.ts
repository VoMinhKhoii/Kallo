import { describe, expect, it } from 'vitest';
import { isPlainRice, riceBowlFor } from '@/lib/ai/portion/data/rice-bowls';

describe('isPlainRice', () => {
  it.each([
    [['cơm']],
    [['Cơm trắng', 'steamed white rice, cooked']],
    [['White rice']],
    [['Jasmine rice']],
    [['밥']],
    [['ご飯']],
    [['米饭']],
    [['Bhaat', 'steamed white rice']],
    // "rang" (cơm rang) must not match inside "orange"; decomposed
    // Vietnamese still reads.
    [['Cơm trắng', 'Orange County kitchen']],
    [['Cơm trắng'.normalize('NFD')]],
    // Portion notes Call 1 leaves in queryEn do not change the food.
    [['Cơm', 'plain cooked white rice, heaped bowl plus extra half bowl']],
    [['White rice', 'white rice, cooked, second helping']],
    // How the food cards write it.
    [['Rice, white, medium-grain, cooked, enriched']],
    [['long-grain white rice, cooked without salt, unenriched']],
    [
      [
        'Cơm trắng, hạt trung bình, đã nấu chín',
        'medium-grain white rice, cooked',
      ],
    ],
  ])('plain rice: %j', (names) => {
    expect(isPlainRice(names)).toBe(true);
  });

  it.each([
    [['Cơm chiên', 'fried rice']],
    [['Egg fried rice']],
    [['Cháo', 'rice porridge']],
    [['Bún', 'rice vermicelli noodles']],
    [['Xôi', 'glutinous rice, steamed']],
    [['Rice cakes']],
    [['Gạo', 'raw white rice']],
    [['Chè đậu xanh']],
    [['Cơm gà']],
    [['비빔밥']],
    [['炒米饭']],
    [['Dal bhat']],
    // An allowlist: any other word makes it another rice food.
    [['Rice pasta', 'brown rice pasta, cooked']],
    [['Rice cereal', 'crisped rice cereal']],
    [['Cơm', 'orange-scented steamed rice']],
    [['Cơm chiên']],
    [['Rice and beans', 'rice and black beans']],
    [['Gạo', 'white rice, raw, cooked from 80g dry rice']],
  ])('not plain rice: %j', (names) => {
    expect(isPlainRice(names)).toBe(false);
  });
});

describe('riceBowlFor', () => {
  it('uses the country of origin, then residence, then the default', () => {
    expect(riceBowlFor({ countryOfOrigin: 'Vietnam' }).mid).toBe(120);
    expect(
      riceBowlFor({
        countryOfOrigin: 'South Korea',
        countryOfResidence: 'Vietnam',
      }).mid
    ).toBe(210);
    expect(
      riceBowlFor({ countryOfOrigin: null, countryOfResidence: 'Japan' }).mid
    ).toBe(150);
    expect(riceBowlFor({ countryOfOrigin: 'Germany' }).mid).toBe(150);
    expect(riceBowlFor({}).mid).toBe(150);
  });

  it('spans a small bowl to a heaped one around the middle', () => {
    expect(riceBowlFor({ countryOfOrigin: 'Vietnam' })).toEqual({
      low: 80,
      mid: 120,
      high: 160,
    });
  });
});
