import { describe, expect, it } from 'vitest';
import {
  englishName,
  formatGrams,
  initialManualGrams,
  type ManualSheetItem,
  manualRulerRange,
  mealKcalWith,
  mealSubtitle,
  searchSubtitle,
  sheetItemsAsRows,
  steppedManualGrams,
  vesselFromHint,
} from '@/lib/domain/logging/manual-display';
import {
  type IngredientSearchResult,
  manualMealTitle,
  rowLabel,
} from '@/lib/domain/logging/manual-logging';

function food(
  overrides: Partial<IngredientSearchResult> = {}
): IngredientSearchResult {
  return {
    id: 'a',
    namePrimary: 'Ức gà',
    nameEn: 'Chicken, broilers or fryers, breast, meat only, raw',
    nameAlt: null,
    state: 'raw',
    similarity: 1,
    per100g: { caloriesKcal: 120, proteinG: 22.5, carbohydrateG: 0, fatG: 2.6 },
    displayNameEn: 'Skinless chicken breast',
    stateLabel: 'raw',
    brand: null,
    vessel: { family: 'piece', kind: 'poultry' },
    ...overrides,
  };
}

const word = (state: 'raw' | 'cooked') => (state === 'raw' ? 'Raw' : 'Cooked');

describe('subtitles', () => {
  it('lead with the state the card claims, then the English name', () => {
    expect(searchSubtitle(food(), word)).toEqual({
      lead: 'Raw',
      rest: 'Skinless chicken breast',
    });
  });

  it('show no state when the card names none — never the table default', () => {
    const yogurt = food({ stateLabel: null, displayNameEn: 'Plain yogurt' });
    expect(searchSubtitle(yogurt, word)).toEqual({
      lead: null,
      rest: 'Plain yogurt',
    });
  });

  it('a brand takes the state slot', () => {
    const milk = food({ stateLabel: null, brand: 'Vinamilk' });
    expect(searchSubtitle(milk, word).lead).toBe('Vinamilk');
  });

  it('falls back to the table English name, then to none', () => {
    expect(englishName(food({ displayNameEn: null }))).toMatch(/^Chicken/);
    expect(englishName(food({ displayNameEn: null, nameEn: '  ' }))).toBeNull();
    // A response older than the card fields still reads.
    expect(englishName(food({ displayNameEn: undefined }))).toMatch(/^Chicken/);
  });

  it('a meal row swaps the English name for its grams', () => {
    expect(mealSubtitle(food(), word, '150 g')).toEqual({
      lead: 'Raw',
      rest: '150 g',
    });
  });
});

describe('vessels and amounts', () => {
  it('opens a hint at its everyday tier', () => {
    expect(vesselFromHint({ family: 'piece', kind: 'fish' })).toEqual({
      family: 'piece',
      tier: 3,
      count: 1,
      kind: 'fish',
    });
    expect(
      vesselFromHint({ family: 'bowl', dishClass: 'solid' })
    ).toMatchObject({ tier: 1 });
    expect(vesselFromHint({ family: 'bowl', dishClass: 'soup' })).toMatchObject(
      {
        tier: 2,
      }
    );
    expect(vesselFromHint(null)).toBeNull();
    expect(vesselFromHint(undefined)).toBeNull();
  });

  it('opens a food page at its vessel, else 100 g — same numbers as iOS', () => {
    expect(initialManualGrams(food())).toBe(150);
    expect(
      initialManualGrams(
        food({ vessel: { family: 'bowl', dishClass: 'solid' } })
      )
    ).toBe(225);
    expect(
      initialManualGrams(
        food({ vessel: { family: 'cup', dishClass: 'drink' } })
      )
    ).toBe(231);
    expect(initialManualGrams(food({ vessel: null }))).toBe(100);
  });

  it('− / + land on the next multiple of 10 and stop at the range', () => {
    expect(steppedManualGrams(147, 1)).toBe(150);
    expect(steppedManualGrams(147, -1)).toBe(140);
    expect(steppedManualGrams(150, -1)).toBe(140);
    expect(steppedManualGrams(10, -1)).toBeNull();
    expect(steppedManualGrams(5, 1)).toBe(10);
    expect(steppedManualGrams(5000, 1)).toBeNull();
  });

  it('the ruler spans 10 g to half again past the largest vessel', () => {
    expect(manualRulerRange([30, 70, 150, 250, 500])).toEqual({
      min: 10,
      max: 750,
    });
  });

  it('formats grams without a trailing .0', () => {
    expect(formatGrams(150)).toBe('150');
    expect(formatGrams(37.5)).toBe('37.5');
  });
});

describe('the meal', () => {
  const chicken = food();
  const items: ManualSheetItem[] = [
    { id: 'i1', ingredient: chicken, grams: 150 },
  ];

  it('totals with a food added, or replacing its own amount', () => {
    expect(mealKcalWith(items, chicken, 100)).toBe(180 + 120);
    expect(mealKcalWith(items, chicken, 100, 'i1')).toBe(120);
    expect(mealKcalWith([], chicken, 50)).toBe(60);
  });

  it('saves sheet items as rows labelled by the food name', () => {
    const [row] = sheetItemsAsRows(items);
    expect(row.grams).toBe('150');
    expect(rowLabel(row)).toBe('Ức gà');
  });

  it('titles an unnamed meal with its ingredient names', () => {
    expect(manualMealTitle(undefined, ['Ức gà', 'Cơm trắng'])).toBe(
      'Ức gà + Cơm trắng'
    );
    expect(manualMealTitle('  Cơm gà ', ['Ức gà'])).toBe('Cơm gà');
  });
});
