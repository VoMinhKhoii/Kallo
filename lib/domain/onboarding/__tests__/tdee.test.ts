import { describe, expect, it } from 'vitest';
import { goalSchema } from '@/lib/domain/onboarding/schemas';
import {
  calcBMR,
  calcCalorieFloor,
  calcDailyTargets,
  calcMacroGrams,
  calcTDEE,
  floorSubmittedTarget,
} from '@/lib/domain/onboarding/tdee';

describe('calcBMR', () => {
  it('computes male BMR correctly (70kg/175cm/30y)', () => {
    const result = calcBMR({
      biologicalSex: 'male',
      weightKg: 70,
      heightCm: 175,
      age: 30,
      activityLevel: 'sedentary',
    });
    // (10×70) + (6.25×175) - (5×30) + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
    expect(result).toBe(1648.75);
  });

  it('computes female BMR correctly (55kg/160cm/25y)', () => {
    const result = calcBMR({
      biologicalSex: 'female',
      weightKg: 55,
      heightCm: 160,
      age: 25,
      activityLevel: 'sedentary',
    });
    // (10×55) + (6.25×160) - (5×25) - 161 = 550 + 1000 - 125 - 161 = 1264
    expect(result).toBe(1264);
  });
});

describe('calcTDEE', () => {
  it('computes sedentary TDEE (BMR 1648.75 × 1.2)', () => {
    expect(calcTDEE(1648.75, 'sedentary')).toBe(1979);
  });

  it('computes moderate TDEE (BMR 1648.75 × 1.55)', () => {
    expect(calcTDEE(1648.75, 'moderate')).toBe(2556);
  });
});

describe('calcMacroGrams', () => {
  it('computes moderate_carb macros for 2000 cal', () => {
    // 30/35/35 split
    const result = calcMacroGrams(2000, 'moderate_carb');
    expect(result.calories).toBe(2000);
    expect(result.proteinG).toBe(150); // (2000*0.30)/4
    expect(result.fatG).toBe(78); // (2000*0.35)/9 = 77.78 → 78
    expect(result.carbsG).toBe(175); // (2000*0.35)/4
  });

  it('computes lower_carb macros for 2000 cal', () => {
    // 40/40/20 split
    const result = calcMacroGrams(2000, 'lower_carb');
    expect(result.calories).toBe(2000);
    expect(result.proteinG).toBe(200); // (2000*0.40)/4
    expect(result.fatG).toBe(89); // (2000*0.40)/9 = 88.89 → 89
    expect(result.carbsG).toBe(100); // (2000*0.20)/4
  });
});

describe('calcDailyTargets', () => {
  it('cutting with 0.5 kg/week aggression reduces by 550', () => {
    const result = calcDailyTargets(
      2000,
      'cutting',
      0.5,
      'moderate_carb',
      'female'
    );
    expect(result.calories).toBe(1450);
    // Verify macros at 1450 cal, moderate_carb (30/35/35)
    expect(result.proteinG).toBe(109); // (1450*0.30)/4 = 108.75 → 109
    expect(result.fatG).toBe(56); // (1450*0.35)/9 = 56.39 → 56
    expect(result.carbsG).toBe(127); // (1450*0.35)/4 = 126.875 → 127
  });

  it('bulking with 0.25 kg/week aggression increases by 275', () => {
    const result = calcDailyTargets(
      2000,
      'bulking',
      0.25,
      'moderate_carb',
      'female'
    );
    expect(result.calories).toBe(2275);
    // Verify macros at 2275 cal, moderate_carb (30/35/35)
    expect(result.proteinG).toBe(171); // (2275*0.30)/4 = 170.625 → 171
    expect(result.fatG).toBe(88); // (2275*0.35)/9 = 88.47 → 88
    expect(result.carbsG).toBe(199); // (2275*0.35)/4 = 199.06 → 199
  });

  it('maintaining ignores aggression and uses TDEE directly', () => {
    const result = calcDailyTargets(
      2000,
      'maintaining',
      null,
      'moderate_carb',
      'female'
    );
    expect(result.calories).toBe(2000);
    expect(result.proteinG).toBe(150);
    expect(result.fatG).toBe(78);
    expect(result.carbsG).toBe(175);
  });

  it('deficitOverride=400 overrides 0.5 (550) aggression', () => {
    const result = calcDailyTargets(
      2000,
      'cutting',
      0.5,
      'moderate_carb',
      'female',
      400
    );
    // 2000 - 400 = 1600
    expect(result.calories).toBe(1600);
  });

  it('deficitOverride=null falls through to aggression via ??', () => {
    const result = calcDailyTargets(
      2000,
      'cutting',
      0.5,
      'moderate_carb',
      'female',
      null
    );
    // null ?? 550 = 550 → 2000 - 550 = 1450
    expect(result.calories).toBe(1450);
  });
});

describe('calorie floor', () => {
  it('holds a female cut at 1,200 kcal and re-derives the macros', () => {
    // 1600 - 0.8 × 1100 = 720 → 1200
    const result = calcDailyTargets(
      1600,
      'cutting',
      0.8,
      'moderate_carb',
      'female'
    );
    expect(result).toEqual(calcMacroGrams(1200, 'moderate_carb'));
  });

  it('holds a male cut at 1,500 kcal', () => {
    // 2000 - 550 = 1450 → 1500
    const result = calcDailyTargets(
      2000,
      'cutting',
      0.5,
      'moderate_carb',
      'male'
    );
    expect(result.calories).toBe(1500);
  });

  it('never sets a cut above maintenance when TDEE is under the floor', () => {
    const result = calcDailyTargets(
      1100,
      'cutting',
      0.5,
      'moderate_carb',
      'female'
    );
    expect(result.calories).toBe(1100);
    expect(calcCalorieFloor('female', 1100)).toBe(1100);
  });

  it('keeps the 500 kcal backstop under a tiny TDEE', () => {
    expect(calcCalorieFloor('female', 320)).toBe(500);
  });

  it('a deficitOverride cannot cut through the floor', () => {
    const result = calcDailyTargets(
      1800,
      'cutting',
      null,
      'moderate_carb',
      'female',
      1500
    );
    expect(result.calories).toBe(1200);
  });
});

describe('floorSubmittedTarget', () => {
  const base = {
    tdeeKcal: 1600,
    biologicalSex: 'female',
    carbSplit: 'moderate_carb',
  };

  it('passes a target at or above the floor through without macros', () => {
    expect(floorSubmittedTarget({ ...base, calorieTarget: 1328 })).toEqual({
      calorieTarget: 1328,
      macros: null,
    });
  });

  it('raises an old build’s 500-floored target and re-derives its macros', () => {
    expect(floorSubmittedTarget({ ...base, calorieTarget: 720 })).toEqual({
      calorieTarget: 1200,
      macros: calcMacroGrams(1200, 'moderate_carb'),
    });
  });

  it('falls back to 500 when the sex or TDEE is unknown', () => {
    expect(
      floorSubmittedTarget({
        calorieTarget: 300,
        tdeeKcal: null,
        biologicalSex: 'female',
        carbSplit: 'moderate_carb',
      }).calorieTarget
    ).toBe(500);
    expect(
      floorSubmittedTarget({
        ...base,
        biologicalSex: undefined,
        calorieTarget: 900,
      })
    ).toEqual({ calorieTarget: 900, macros: null });
  });

  it('raises the target but leaves macros alone when the split is unknown', () => {
    expect(
      floorSubmittedTarget({ ...base, carbSplit: 'keto', calorieTarget: 720 })
    ).toEqual({ calorieTarget: 1200, macros: null });
  });
});

describe('goalSchema validation', () => {
  it('rejects cutting with null aggression', () => {
    const result = goalSchema.safeParse({
      goal: 'cutting',
      aggression: null,
      carbSplit: 'moderate_carb',
      deficitOverride: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('aggression');
    }
  });

  it('accepts cutting with valid numeric aggression', () => {
    const result = goalSchema.safeParse({
      goal: 'cutting',
      aggression: 0.5,
      carbSplit: 'moderate_carb',
      deficitOverride: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts maintaining with null aggression', () => {
    const result = goalSchema.safeParse({
      goal: 'maintaining',
      aggression: null,
      carbSplit: 'moderate_carb',
      deficitOverride: null,
    });
    expect(result.success).toBe(true);
  });
});
