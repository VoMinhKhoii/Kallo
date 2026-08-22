import { describe, expect, it } from 'vitest';
import {
  classifyIngredientPlausibility,
  STAPLE_MIN_CARBS_PER_100G,
} from '@/lib/ai/pipeline/resolve/plausibility/plausibility';

describe('classifyIngredientPlausibility — unresolved', () => {
  it('flags a missing portion as unresolved_estimate', () => {
    expect(
      classifyIngredientPlausibility({
        grams: null,
        hasNutrition: false,
        caloriesPer100g: null,
        name: 'ức gà',
      })
    ).toBe('unresolved_estimate');
  });

  it('flags zero/negative/non-finite grams as unresolved_estimate', () => {
    for (const grams of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        classifyIngredientPlausibility({
          grams,
          hasNutrition: true,
          caloriesPer100g: 200,
          name: 'cơm',
        })
      ).toBe('unresolved_estimate');
    }
  });

  it('flags a resolved portion with no nutrition as unresolved_estimate', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 100,
        hasNutrition: false,
        caloriesPer100g: 130,
        name: 'cơm',
      })
    ).toBe('unresolved_estimate');
  });
});

describe('classifyIngredientPlausibility — genuinely non-caloric', () => {
  it('does NOT flag water even at a large volume (near-zero density)', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 300,
        hasNutrition: true,
        caloriesPer100g: 0,
        name: 'nước lọc',
      })
    ).toBe('genuinely_noncaloric');
  });

  it('classifies black coffee / plain tea by name even without a match', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 200,
        hasNutrition: true,
        caloriesPer100g: null,
        name: 'black coffee',
      })
    ).toBe('genuinely_noncaloric');
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        name: 'trà đá không đường',
      })
    ).toBe('genuinely_noncaloric');
  });

  it('does NOT classify caloric compounds as noncaloric (trà sữa, ice cream)', () => {
    // Review finding: unanchored patterns matched "trà sữa"/"ice cream" and,
    // because the noncaloric check precedes the missing-macros guard, an
    // unmatched milk tea could persist a silent ZERO_TRIPLE.
    for (const name of [
      'trà sữa trân châu',
      'trà đào',
      'ice cream',
      'iced coffee',
    ]) {
      expect(
        classifyIngredientPlausibility({
          grams: 200,
          hasNutrition: false,
          caloriesPer100g: null,
          name,
        })
      ).not.toBe('genuinely_noncaloric');
    }
  });

  it('classifies ice by name (cà phê sữa đá decomposes to a standalone Đá)', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 100,
        hasNutrition: true,
        caloriesPer100g: 0,
        name: 'Đá',
      })
    ).toBe('genuinely_noncaloric');
    expect(
      classifyIngredientPlausibility({
        grams: 100,
        hasNutrition: true,
        caloriesPer100g: 0,
        name: 'ice cubes',
      })
    ).toBe('genuinely_noncaloric');
  });
});

describe('classifyIngredientPlausibility — small concentrated portions', () => {
  it('permits a ≤5g oil/spice/sweetener/sauce portion', () => {
    for (const name of ['dầu ăn', 'muối', 'đường', 'nước mắm', 'olive oil']) {
      expect(
        classifyIngredientPlausibility({
          grams: 3,
          hasNutrition: true,
          caloriesPer100g: 884,
          name,
        })
      ).toBe('small_concentrated_portion');
    }
  });

  it('does NOT give a small non-concentrated food a pass (blanket ≤5g rejected)', () => {
    // A 3g "chicken breast" is implausible but not in the concentrated class,
    // so it is NOT small_concentrated_portion — it falls through to 'ok' and
    // downstream anomaly detection can still flag it.
    expect(
      classifyIngredientPlausibility({
        grams: 3,
        hasNutrition: true,
        caloriesPer100g: 165,
        name: 'ức gà',
      })
    ).toBe('ok');
  });

  it('does not treat a large oil portion as small_concentrated', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 40,
        hasNutrition: true,
        caloriesPer100g: 884,
        name: 'dầu ăn',
      })
    ).toBe('ok');
  });
});

describe('classifyIngredientPlausibility — ok', () => {
  it('classifies a normal resolved ingredient as ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 150,
        hasNutrition: true,
        caloriesPer100g: 165,
        name: 'ức gà',
      })
    ).toBe('ok');
  });
});

describe('classifyIngredientPlausibility — carb-staple floor', () => {
  it('flags the bánh ướt bug (unmatched staple, C≈0) as unresolved_estimate', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        carbsPer100g: 0,
        name: 'bánh ướt',
      })
    ).toBe('unresolved_estimate');
  });

  it('flags a C≈0 emission across the staple class', () => {
    for (const name of [
      'bánh cuốn',
      'bánh phở',
      'bún',
      'hủ tiếu',
      'xôi',
      'cơm',
      'rice noodles',
      'bread',
    ]) {
      expect(
        classifyIngredientPlausibility({
          grams: 250,
          hasNutrition: true,
          caloriesPer100g: null,
          carbsPer100g: 0,
          name,
        })
      ).toBe('unresolved_estimate');
    }
  });

  it('flags an unmatched staple with the carb triple omitted (null carbs, null calories)', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        carbsPer100g: null,
        name: 'bún',
      })
    ).toBe('unresolved_estimate');
  });

  it('flags a matched staple onto a ~0-carb row (below the floor)', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: 120,
        carbsPer100g: 1,
        name: 'bánh phở',
      })
    ).toBe('unresolved_estimate');
  });

  it('does NOT flag a healthy matched staple → ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: 108,
        carbsPer100g: 24.9,
        name: 'bánh ướt',
      })
    ).toBe('ok');
  });

  it('does NOT flag a healthy unmatched staple → ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        carbsPer100g: 25,
        name: 'bánh ướt',
      })
    ).toBe('ok');
  });

  it('exempts named low-carb noodle substitutes → ok', () => {
    for (const name of ['bún konjac', 'shirataki noodles']) {
      expect(
        classifyIngredientPlausibility({
          grams: 250,
          hasNutrition: true,
          caloriesPer100g: null,
          carbsPer100g: 2,
          name,
        })
      ).toBe('ok');
    }
  });

  it('exempts broths that carry a staple dish name → ok', () => {
    for (const name of ['nước dùng phở', 'nước lèo hủ tiếu']) {
      expect(
        classifyIngredientPlausibility({
          grams: 250,
          hasNutrition: true,
          caloriesPer100g: null,
          carbsPer100g: 1,
          name,
        })
      ).toBe('ok');
    }
  });

  it('does NOT flag mì chính (MSG) via the staple floor', () => {
    // "mì" substring-matches the staple list but "mì chính" is exempt, so the
    // carb floor never trips. The concentrated-class MSG patterns key on "bột
    // ngọt"/"msg" (not "mì chính"), so this lands on 'ok' here — the point is
    // only that it is NOT unresolved_estimate.
    expect(
      classifyIngredientPlausibility({
        grams: 3,
        hasNutrition: true,
        caloriesPer100g: null,
        carbsPer100g: 0,
        name: 'mì chính',
      })
    ).not.toBe('unresolved_estimate');
  });

  it('exempts giấm gạo (vinegar) → ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        carbsPer100g: 0.4,
        name: 'giấm gạo',
      })
    ).toBe('ok');
  });

  it('does NOT flag a non-staple zero-carb food → ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: 165,
        carbsPer100g: 0,
        name: 'ức gà',
      })
    ).toBe('ok');
  });

  it('does NOT flag a matched staple with NULL DB carbs but real calories → ok', () => {
    // Documented gap: all current staple rows carry carbs, so a null DB carb
    // with a real energy density passes rather than clarifies.
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: 110,
        carbsPer100g: null,
        name: 'bún',
      })
    ).toBe('ok');
  });

  it('is backward-compatible when carbsPer100g is omitted entirely → ok', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 250,
        hasNutrition: true,
        caloriesPer100g: null,
        name: 'bánh ướt',
      })
    ).toBe('ok');
  });

  it('does NOT flag "miếng <food>" — the classifier is not the noodle miến', () => {
    // Prod regression (request 3ae446c9-e2ef-4f56-84ef-759e096a935a, "1 miếng
    // vịt"): `/miến/i` substring-matched "miếng" (a piece/slice), so a matched
    // 0-carb duck row tripped the staple floor and blanked the entire meal.
    expect(
      classifyIngredientPlausibility({
        grams: 160,
        hasNutrition: true,
        caloriesPer100g: 267,
        carbsPer100g: 0,
        name: 'miếng vịt',
      })
    ).toBe('ok');
    for (const name of ['miếng thịt bò', 'miếng phô mai', 'Miếng cá hồi']) {
      expect(
        classifyIngredientPlausibility({
          grams: 120,
          hasNutrition: true,
          caloriesPer100g: 200,
          carbsPer100g: 0,
          name,
        })
      ).toBe('ok');
    }
  });

  it('still flags the real miến (glass noodle) at C≈0', () => {
    for (const name of ['miến', 'miến gà', 'tô miến trộn']) {
      expect(
        classifyIngredientPlausibility({
          grams: 200,
          hasNutrition: true,
          caloriesPer100g: 110,
          carbsPer100g: 0,
          name,
        })
      ).toBe('unresolved_estimate');
    }
  });

  it('still catches a staple sitting inside a classifier phrase', () => {
    expect(
      classifyIngredientPlausibility({
        grams: 90,
        hasNutrition: true,
        caloriesPer100g: 260,
        carbsPer100g: 0,
        name: 'miếng bánh mì',
      })
    ).toBe('unresolved_estimate');
  });

  it('does NOT let a caloric modifier inherit the noncaloric zero', () => {
    // `/\bwater\b/`, `/\bblack\s*coffee\b/` and `/\bgreen\s*tea\b/` are matched
    // loosely, so a caloric variant used to be classified genuinely_noncaloric
    // and ship a zero row.
    for (const name of [
      'coconut water',
      'nước dừa',
      'black coffee with sugar',
      'green tea latte',
      'trà sữa',
      'cà phê sữa đá',
    ]) {
      expect(
        classifyIngredientPlausibility({
          grams: 250,
          hasNutrition: true,
          caloriesPer100g: null,
          name,
        })
      ).not.toBe('genuinely_noncaloric');
    }
  });

  it('keeps sugar-free variants noncaloric', () => {
    // "không đường" must not be disqualified by the bare word "đường".
    for (const name of [
      'trà đá không đường',
      'unsweetened green tea',
      'nước lọc',
      'black coffee',
    ]) {
      expect(
        classifyIngredientPlausibility({
          grams: 250,
          hasNutrition: true,
          caloriesPer100g: null,
          name,
        })
      ).toBe('genuinely_noncaloric');
    }
  });

  it('exempt list no longer fires on unrelated substrings', () => {
    // `/stock/` exempted "stockfish noodles"; `/wine/` exempted "bánh mì
    // wineberry" — both suppressed a real staple failure.
    for (const name of ['stockfish noodles', 'bánh mì wineberry']) {
      expect(
        classifyIngredientPlausibility({
          grams: 200,
          hasNutrition: true,
          caloriesPer100g: 200,
          carbsPer100g: 0,
          name,
        })
      ).toBe('unresolved_estimate');
    }
    // Real exemptions still hold, including mixed-diacritic spellings.
    for (const name of ['nước dùng phở', 'mì chính', 'mi chính', 'mì chinh']) {
      expect(
        classifyIngredientPlausibility({
          grams: 200,
          hasNutrition: true,
          caloriesPer100g: 200,
          carbsPer100g: 0,
          name,
        })
      ).not.toBe('unresolved_estimate');
    }
  });

  it('lets genuinely_noncaloric win precedence over the staple floor', () => {
    // Threshold sanity: 0 is below STAPLE_MIN_CARBS_PER_100G, but nước lọc is
    // non-caloric and returns before the staple check runs.
    expect(STAPLE_MIN_CARBS_PER_100G).toBeGreaterThan(0);
    expect(
      classifyIngredientPlausibility({
        grams: 300,
        hasNutrition: true,
        caloriesPer100g: 0,
        carbsPer100g: 0,
        name: 'nước lọc',
      })
    ).toBe('genuinely_noncaloric');
  });
});
