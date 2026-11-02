import { describe, expect, it } from 'vitest';
import { calcBMR, calcTDEE } from '@/lib/domain/onboarding/tdee';
import {
  bmi,
  bmiBand,
  ftInToCm,
  goalPlan,
  kgToLb,
  lbToKg,
  normalWeightRange,
  proteinRange,
  valid,
} from '@/lib/seo/tools/math';

// The worked examples the pages print. If the app's maths moves, these fail
// and the copy has to be re-checked against the new numbers.
const enWoman = calcTDEE(
  calcBMR({
    biologicalSex: 'female',
    age: 30,
    weightKg: 65,
    heightCm: 165,
    activityLevel: 'light',
  }),
  'light'
);
const viWoman = calcTDEE(
  calcBMR({
    biologicalSex: 'female',
    age: 25,
    weightKg: 55,
    heightCm: 158,
    activityLevel: 'sedentary',
  }),
  'sedentary'
);
const viMan = calcTDEE(
  calcBMR({
    biologicalSex: 'male',
    age: 28,
    weightKg: 68,
    heightCm: 170,
    activityLevel: 'moderate',
  }),
  'moderate'
);

describe('the pages’ worked examples', () => {
  it('match the app’s TDEE', () => {
    expect(enWoman).toBe(1884);
    expect(viWoman).toBe(1502);
    expect(viMan).toBe(2492);
  });
});

describe('goalPlan', () => {
  it('takes 550 kcal a day off for 0.5 kg a week and counts the weeks', () => {
    const plan = goalPlan({
      tdee: enWoman,
      sex: 'female',
      weightKg: 65,
      goalKg: 60,
      paceKgPerWeek: 0.5,
    });
    expect(plan).toEqual({
      kind: 'open',
      targetKcal: 1334,
      floorKcal: 1200,
      paceKgPerWeek: 0.5,
      weeks: 10,
    });
  });

  it('holds at the floor and reports the slower real pace', () => {
    const plan = goalPlan({
      tdee: viWoman,
      sex: 'female',
      weightKg: 55,
      goalKg: 50,
      paceKgPerWeek: 0.5,
    });
    expect(plan.targetKcal).toBe(1200);
    expect(plan.kind).toBe('floored');
    expect(plan.floorKcal).toBe(1200);
    expect(plan.paceKgPerWeek).toBeCloseTo(0.2745, 3);
    expect(plan.weeks).toBe(19);
  });

  it('adds the surplus when gaining, and does nothing at the same weight', () => {
    const gain = goalPlan({
      tdee: 2000,
      sex: 'male',
      weightKg: 60,
      goalKg: 63,
      paceKgPerWeek: 0.25,
    });
    expect(gain.targetKcal).toBe(2275);
    expect(gain.weeks).toBe(12);
    expect(
      goalPlan({
        tdee: 2000,
        sex: 'male',
        weightKg: 60,
        goalKg: 60,
        paceKgPerWeek: 0.5,
      })
    ).toMatchObject({ kind: 'same', targetKcal: 2000, weeks: null });
  });
});

describe('goalPlan at the floor with no deficit left', () => {
  it('reports no weeks when maintenance is already under the floor', () => {
    // 70-year-old woman, 150 cm, 45 kg, sedentary: TDEE ~1,052, under 1,200,
    // so the floor holds her at maintenance and the goal cannot be reached.
    const tdee = calcTDEE(
      calcBMR({
        biologicalSex: 'female',
        age: 70,
        weightKg: 45,
        heightCm: 150,
        activityLevel: 'sedentary',
      }),
      'sedentary'
    );
    const plan = goalPlan({
      tdee,
      sex: 'female',
      weightKg: 45,
      goalKg: 43,
      paceKgPerWeek: 0.5,
    });
    expect(plan).toMatchObject({
      kind: 'unreachable',
      targetKcal: tdee,
      floorKcal: tdee,
      paceKgPerWeek: 0,
      weeks: null,
    });
  });
});

describe('goalPlan when the 500 kcal backstop exceeds maintenance', () => {
  it('never turns that surplus into a loss', () => {
    const plan = goalPlan({
      tdee: 479,
      sex: 'female',
      weightKg: 31,
      goalKg: 30,
      paceKgPerWeek: 0.5,
    });
    expect(plan).toMatchObject({ kind: 'unreachable', weeks: null });
  });
});

describe('valid', () => {
  it('accepts values inside the limits and rejects typos', () => {
    expect(valid(65, 'weightKg')).toBe(65);
    expect(valid(-70, 'weightKg')).toBeNull();
    expect(valid(1700, 'heightCm')).toBeNull();
    expect(valid(Number.NaN, 'age')).toBeNull();
    expect(valid(undefined, 'age')).toBeNull();
    expect(valid(12, 'age')).toBeNull();
    expect(valid(70, 'bodyFatPct')).toBeNull();
  });
});

describe('proteinRange', () => {
  it('gives the RDA for health and the ISSN range for training', () => {
    expect(proteinRange({ weightKg: 70, goal: 'health' })).toMatchObject({
      lowG: 56,
      highG: 56,
    });
    expect(proteinRange({ weightKg: 70, goal: 'muscle' })).toMatchObject({
      lowG: 98,
      highG: 140,
      basis: 'body',
    });
  });

  it('uses lean mass for a cut only when body fat is given', () => {
    expect(
      proteinRange({ weightKg: 70, goal: 'cut', bodyFatPct: 20 })
    ).toMatchObject({ lowG: 129, highG: 174, basis: 'lean' });
    expect(proteinRange({ weightKg: 70, goal: 'cut' })).toMatchObject({
      lowG: 98,
      highG: 140,
      basis: 'body',
    });
  });
});

describe('BMI', () => {
  it('reads the same number differently under the two standards', () => {
    const value = bmi(60, 160);
    expect(value).toBeCloseTo(23.4, 1);
    expect(bmiBand(value, 'who')).toBe('normal');
    expect(bmiBand(value, 'asia')).toBe('over');
    expect(bmiBand(25, 'asia')).toBe('obese');
    expect(bmiBand(25, 'who')).toBe('over');
    expect(bmiBand(18.4, 'who')).toBe('under');
  });

  it('turns the normal band into a weight range for a height', () => {
    expect(normalWeightRange(160, 'asia')).toEqual([47.4, 58.6]);
    expect(normalWeightRange(160, 'who')).toEqual([47.4, 63.7]);
  });
});

describe('unit conversion', () => {
  it('round-trips pounds and converts feet and inches', () => {
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 10);
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 5);
  });
});
