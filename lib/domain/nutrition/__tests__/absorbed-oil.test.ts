import { describe, expect, it } from 'vitest';
import type { RawNutritionAdjustment } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { __testing } from '@/lib/ai/pipeline/resolve/macro-resolution';
import {
  ABSORBED_OIL_RANGES,
  absorbedOil,
  COOKING_FAT_ROW_NAMES,
  isAlreadyFriedRow,
  isDiscreteOilIngredient,
  mealItemHasDiscreteOil,
  prepNotesAskForExtraFat,
  renderAbsorbedOilPromptRule,
  saysNoOil,
} from '@/lib/domain/nutrition/absorbed-oil';

const vegetableEstimate: RawNutritionAdjustment['mealItems'][number]['ingredients'][number] =
  {
    ingredientName: 'rau muống',
    proteinG: { low: 2, mid: 3, high: 4 },
    carbohydrateG: { low: 4, mid: 5, high: 6 },
    fatG: { low: 6, mid: 7, high: 8 },
  };

describe('absorbed cooking oil', () => {
  it('uses one shared set of figures for the prompt and server allowance', () => {
    const promptRule = renderAbsorbedOilPromptRule();
    expect(promptRule).toContain(
      `stir-fry ${ABSORBED_OIL_RANGES.stirFryG.low}–${ABSORBED_OIL_RANGES.stirFryG.high}g`
    );
    expect(promptRule).toContain(
      `deep-fry ~${ABSORBED_OIL_RANGES.deepFryWeightRatio.low * 100}–${ABSORBED_OIL_RANGES.deepFryWeightRatio.high * 100}%`
    );
    expect(absorbedOil('xào', 100)).toBe(ABSORBED_OIL_RANGES.stirFryG.high);
    expect(absorbedOil('chiên ngập dầu', 100)).toBe(
      100 * ABSORBED_OIL_RANGES.deepFryWeightRatio.high
    );
  });

  it('returns zero for absent and explicitly no-oil methods', () => {
    expect(absorbedOil(null, 100)).toBe(0);
    expect(absorbedOil('nướng không dầu', 100)).toBe(0);
    expect(absorbedOil('air-fried', 100)).toBe(0);
  });

  it('lets a stir-fried vegetable retain non-trivial absorbed fat', () => {
    const resolved = __testing.resolveIngredientMacros(
      vegetableEstimate,
      {
        caloriesKcal: 20,
        proteinG: 2,
        carbohydrateG: 3,
        fatG: 0.4,
      },
      100,
      false,
      'xào'
    );

    expect(resolved.fatG).toEqual({ low: 6, mid: 7, high: 8 });
    expect(resolved.fatG.mid).toBeGreaterThan(5);

    const clamped = __testing.resolveIngredientMacros(
      {
        ...vegetableEstimate,
        fatG: { low: 18, mid: 20, high: 22 },
      },
      {
        caloriesKcal: 20,
        proteinG: 2,
        carbohydrateG: 3,
        fatG: 0.4,
      },
      100,
      false,
      'xào'
    );
    // base × 3 + stir-fry maximum = 0.4 × 3 + 10 = 11.2g.
    expect(clamped.fatG.mid).toBeCloseTo(11.2, 8);
    expect(clamped.fatG.mid).not.toBeCloseTo(0.4, 8);
  });
});

/**
 * Cooking fat is counted exactly once. Call 1 emits it as its own ingredient
 * so its grams, fat and micronutrients (vitamin E especially) reach the meal
 * total; Call 2 and the server guard must then NOT also load it into whatever
 * it was fried in. Observed before this rule: a plate of deep-fried potatoes
 * reporting 21.8g of absorbed fat beside a discrete 25g `Oil` row.
 */
describe('discrete oil rows suppress the sibling allowance', () => {
  it('identifies cooking fats, and does not mistake avocado for butter', () => {
    for (const name of ['dầu ăn', 'Dầu', 'Oil', 'butter', 'ghee', 'mỡ heo']) {
      expect(isDiscreteOilIngredient(name)).toBe(true);
    }
    // `bơ` alone is avocado as often as butter in Vietnamese; a false positive
    // would silently strip the oil allowance from every other ingredient.
    for (const name of [
      'quả bơ',
      'bơ',
      'khoai tây',
      'rau muống',
      'Xì dầu',
      'xì dầu',
      '',
    ]) {
      expect(isDiscreteOilIngredient(name)).toBe(false);
    }
    expect(mealItemHasDiscreteOil(['Khoai tây', 'Dầu ăn'])).toBe(true);
    expect(mealItemHasDiscreteOil(['Khoai tây', 'Thịt bò'])).toBe(false);
  });

  // `dầu giấm` and `dầu hào` carry the token `dầu` without being the fat
  // anything was fried in. Counting them as the dish's cooking fat strips the
  // absorbed-oil allowance from a genuinely fried sibling — the opposite of
  // this module's purpose. `salad dầu giấm` is in our own eval set.
  it('does not mistake vinaigrette or oyster sauce for cooking fat', () => {
    expect(isDiscreteOilIngredient('dầu giấm')).toBe(false);
    expect(isDiscreteOilIngredient('Salad dầu giấm')).toBe(false);
    expect(isDiscreteOilIngredient('dầu hào')).toBe(false);
    expect(isDiscreteOilIngredient('sốt dầu hào')).toBe(false);
    // Sesame oil genuinely is a fat and must keep matching.
    expect(isDiscreteOilIngredient('dầu mè')).toBe(true);
    expect(mealItemHasDiscreteOil(['Cá chiên', 'Salad dầu giấm'])).toBe(false);
    expect(mealItemHasDiscreteOil(['Cá chiên', 'Dầu ăn'])).toBe(true);
  });

  // The prompt renders this list verbatim, so a name it offers Call 1 that
  // this module cannot read back is exactly the drift that let a butter row's
  // siblings claim absorbed oil on top of it.
  it('recognises every cooking-fat name the decomposition prompt asks for', () => {
    for (const name of COOKING_FAT_ROW_NAMES) {
      expect(isDiscreteOilIngredient(name)).toBe(true);
    }
  });

  it('does not grant a fried food an allowance when the oil has its own row', () => {
    const base = {
      caloriesKcal: 80,
      proteinG: 2,
      carbohydrateG: 18,
      fatG: 0.25,
    };
    const friedPotato = {
      ...vegetableEstimate,
      ingredientName: 'Khoai tây',
      fatG: { low: 18, mid: 21.8, high: 26 },
    };

    // No discrete oil row: the potato absorbs, so the allowance applies.
    const absorbing = __testing.resolveIngredientMacros(
      friedPotato,
      base,
      250,
      false,
      'deep-fried',
      [],
      false
    );
    expect(absorbing.fatG.mid).toBeCloseTo(21.8, 8);

    // A sibling `Oil` row exists: the potato is capped at 1.25× base with zero
    // oil allowance instead of double-counting the same oil.
    const suppressed = __testing.resolveIngredientMacros(
      friedPotato,
      base,
      250,
      false,
      'deep-fried',
      [],
      true
    );
    expect(suppressed.fatG.mid).toBeCloseTo(base.fatG * 1.25, 8);
    expect(suppressed.fatG.mid).toBeLessThan(absorbing.fatG.mid);
  });

  it('keeps the oil row own allowance so it is not clamped to an unfried base', () => {
    const oilRow = {
      ...vegetableEstimate,
      ingredientName: 'Dầu ăn',
      fatG: { low: 22, mid: 25, high: 28 },
    };
    const resolved = __testing.resolveIngredientMacros(
      oilRow,
      { caloriesKcal: 221, proteinG: 0, carbohydrateG: 0, fatG: 25 },
      25,
      false,
      'deep-fried',
      [],
      true
    );
    expect(resolved.fatG.mid).toBeCloseTo(25, 8);
  });
});

/**
 * Callers concatenate the dish cooking method with the user's verbatim prep
 * notes, so the two can contradict each other. Resolution is by specificity,
 * and both directions of that trap are load-bearing: testing no-oil first
 * fails closed to the original bug (a typed `chiên ngập dầu` yielding zero
 * allowance), while testing fry first charges `chiên không dầu` a full
 * shallow-fry allowance it never absorbed.
 */
describe('absorbedOil precedence with contradictory signals', () => {
  const GRAMS = 150;

  it('lets an explicit deep-fry beat a stale no-oil method', () => {
    const deepFry = GRAMS * ABSORBED_OIL_RANGES.deepFryWeightRatio.high;
    // `luộc` here is the dish-level method Call 1 broadcast onto the tofu;
    // `chiên ngập dầu` is what the user actually typed.
    expect(absorbedOil('luộc chiên ngập dầu', GRAMS)).toBeCloseTo(deepFry, 8);
    expect(absorbedOil('boiled deep-fried', GRAMS)).toBeCloseTo(deepFry, 8);
    expect(absorbedOil('nướng không dầu chiên ngập dầu', GRAMS)).toBeCloseTo(
      deepFry,
      8
    );
  });

  it('lets an explicit negation beat a generic fry verb', () => {
    expect(absorbedOil('chiên không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('air-fried', GRAMS)).toBe(0);
    expect(absorbedOil('nướng không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('luộc', GRAMS)).toBe(0);
  });

  // A method that simply uses no fat is not a statement that no fat was used.
  // Treating `luộc` and `boiled` as negations made every two-stage dish report
  // zero absorbed oil, which is the original bug wearing a different hat.
  it('lets a fry verb beat a merely non-fry method that preceded it', () => {
    const shallowFry = ABSORBED_OIL_RANGES.shallowFryG.high;
    expect(absorbedOil('luộc rồi chiên', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('boiled then pan-fried', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('hấp xong chiên', GRAMS)).toBe(shallowFry);
    expect(absorbedOil('luộc xong xào', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.stirFryG.high
    );
    // …but a genuine negation still wins, and a bare non-fry method is zero.
    expect(absorbedOil('luộc rồi chiên không dầu', GRAMS)).toBe(0);
    expect(absorbedOil('luộc', GRAMS)).toBe(0);
    expect(absorbedOil('hấp', GRAMS)).toBe(0);
  });

  it('still resolves unambiguous methods', () => {
    expect(absorbedOil('chiên ít dầu', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.shallowFryG.high
    );
    expect(absorbedOil('xào', GRAMS)).toBe(ABSORBED_OIL_RANGES.stirFryG.high);
    expect(absorbedOil('áp chảo', GRAMS)).toBe(
      ABSORBED_OIL_RANGES.panSearG.high
    );
    expect(absorbedOil('', GRAMS)).toBe(0);
    expect(absorbedOil('chiên ngập dầu', 0)).toBe(0);
  });
});

describe('isAlreadyFriedRow', () => {
  it('detects fat-fried rows by English row name or card cooking method', () => {
    expect(isAlreadyFriedRow('Egg, whole, cooked, fried')).toBe(true);
    expect(isAlreadyFriedRow('Spring roll', 'deep-fried')).toBe(true);
    // NIN rows have no English name; the curated cooking method decides.
    expect(isAlreadyFriedRow('', 'deep-fried')).toBe(true);
    expect(isAlreadyFriedRow('Egg, whole, cooked, fried', 'pan-fried')).toBe(
      true
    );
  });

  it('excludes plain, air-fried, dry-fried, stir-fried, and pan-fried not-breaded rows', () => {
    expect(isAlreadyFriedRow('Chicken breast, raw')).toBe(false);
    expect(isAlreadyFriedRow('Veal, leg, cooked, pan-fried, not breaded')).toBe(
      false
    );
    expect(isAlreadyFriedRow('Chicken, air-fried')).toBe(false);
    expect(isAlreadyFriedRow('Vegetables, mixed, cooked', 'stir-fried')).toBe(
      false
    );
  });

  it('never reads a fried food into a raw row or a dry mix', () => {
    // USDA's "broilers or fryers" chicken is raw meat (translated "gà rán").
    expect(
      isAlreadyFriedRow(
        'Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw'
      )
    ).toBe(false);
    // "Bột chiên giòn" is dry batter mix: no English name, no cooking method.
    expect(isAlreadyFriedRow('', null)).toBe(false);
    expect(isAlreadyFriedRow(undefined)).toBe(false);
  });
});

describe('fry verbs at word edges', () => {
  it('does not read a fry verb inside another word', () => {
    for (const text of [
      'raw with ranch',
      'orange glaze',
      'cranberry',
      'bánh tráng',
    ]) {
      expect(absorbedOil(text, 100)).toBe(0);
    }
    expect(absorbedOil('deep-frying', 100)).toBeGreaterThan(0);
    expect(absorbedOil('sautéing', 100)).toBeGreaterThan(0);
    expect(absorbedOil('rán vàng', 100)).toBeGreaterThan(0);
  });

  it('reads a negation placed before the addition', () => {
    for (const note of [
      'không thêm dầu',
      'không phết bơ',
      'không có dầu',
      'không rưới dầu',
      'no extra oil',
      'without added butter',
      'not oily',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(false);
    }
  });
});

describe('appliances and negated requests', () => {
  it('reads an air fryer as no oil and a deep fryer as deep-frying', () => {
    expect(absorbedOil('fried, cooked in the air fryer', 100)).toBe(0);
    expect(absorbedOil('air-fryer', 100)).toBe(0);
    expect(absorbedOil('cooked in deep fryer', 200)).toBe(
      200 * ABSORBED_OIL_RANGES.deepFryWeightRatio.high
    );
    // A raw USDA "broilers or fryers" chicken is not fried.
    expect(absorbedOil('fryers', 100)).toBe(0);
  });

  it('reads "no oil" one word ahead', () => {
    for (const text of [
      'không có dầu',
      'không dùng dầu',
      'không thêm dầu',
      'without added oil',
    ]) {
      expect(saysNoOil(text)).toBe(true);
    }
    expect(saysNoOil('chiên ít dầu')).toBe(false);
  });

  it('never reads a negated or reduced request as extra fat', () => {
    for (const note of [
      'no extra olive oil',
      'without added sesame oil',
      'not cooked in butter',
      'not drizzled with oil',
      'without lots of oil',
      'not extra fatty',
      'không có thêm dầu',
      'không chiên ngập dầu',
      'ít dầu',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(false);
    }
  });

  it('leaves oil alone when a note only drops a sauce', () => {
    expect(saysNoOil('không dùng dầu hào')).toBe(false);
    expect(absorbedOil('xào không thêm dầu hào', 150)).toBe(
      ABSORBED_OIL_RANGES.stirFryG.high
    );
  });

  it('keeps a request that follows an unrelated cut', () => {
    for (const note of [
      'không đường phết bơ',
      'no salt extra butter',
      'chả lụa phết bơ',
      'ít muối, dầu nhiều',
      'không đường, phết bơ',
      'không dầu hào thêm dầu',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(true);
    }
  });
});

describe('isAlreadyFriedRow fat floor', () => {
  it('does not treat a lean row labelled fried as holding its frying oil', () => {
    expect(isAlreadyFriedRow('Fish, featherback, fried', null, 0.66)).toBe(
      false
    );
    expect(isAlreadyFriedRow('Egg, whole, cooked, fried', null, 14.8)).toBe(
      true
    );
  });
});

describe('prepNotesAskForExtraFat word edges and condiments', () => {
  it('ignores sauces named with dầu and words that only contain a fat', () => {
    for (const note of [
      'taco bowl',
      'banchan bowl',
      'xì dầu nhiều',
      'thêm dầu hào',
      'nhiều dầu hào',
      'rưới dầu giấm',
      'them bo',
      'them dau',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(false);
    }
  });

  it('still reads a real extra-fat request next to an unrelated word', () => {
    expect(prepNotesAskForExtraFat(['thịt bò thêm dầu'])).toBe(true);
    expect(prepNotesAskForExtraFat(['extra oil, split bowl'])).toBe(true);
  });
});

describe('prepNotesAskForExtraFat', () => {
  it('matches explicit extra-fat requests in English and Vietnamese', () => {
    for (const note of [
      'extra oil',
      'extra butter',
      'with butter',
      'buttered',
      'nhiều mỡ',
      'phết bơ',
      'thêm dầu',
      'thêm dầu nhiều',
      'rưới dầu',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(true);
    }
    // Mixed reduction + addition still unlocks extra fat.
    expect(prepNotesAskForExtraFat(['bỏ da', 'extra butter'])).toBe(true);
  });

  it('does not match negations, fat-reduction notes, or unrelated modifiers', () => {
    for (const note of [
      'bỏ da',
      'bỏ mỡ',
      'không dầu',
      'ít mỡ',
      'ít dầu',
      'no oil',
      'without butter',
      'low-fat',
      'less oil',
      'ít muối',
      'extra spicy',
      'quả bơ',
    ]) {
      expect(prepNotesAskForExtraFat([note])).toBe(false);
    }
    expect(prepNotesAskForExtraFat([])).toBe(false);
    expect(prepNotesAskForExtraFat(undefined)).toBe(false);
  });
});
