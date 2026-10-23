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
    // "rang" must not match inside "orange"; decomposed Vietnamese still reads.
    [['Rice', 'steamed rice, orange-scented']],
    [['Cơm trắng'.normalize('NFD')]],
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
