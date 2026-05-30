import { describe, expect, it } from 'vitest';
import type { CheatSliderSpec } from '@/lib/types/cheat';
import {
  activeAnchorLabel,
  clampLevel,
  defaultLevels,
  resolveSliderNutrition,
} from '../slider-nutrition';

function makeSpec(): CheatSliderSpec {
  return {
    rationale: 'Korean BBQ buffet — meat-forward, some rice, fairly rich.',
    mealSlot: 'dinner',
    confidence: 'medium',
    sliders: [
      {
        key: 'protein',
        label: 'Thịt / hải sản',
        defaultLevel: 5,
        anchors: [
          { level: 0, label: 'không ăn thịt', proteinG: 0 },
          { level: 5, label: 'phần BBQ bình thường', proteinG: 60 },
          { level: 10, label: 'tiệc thịt', proteinG: 120 },
        ],
      },
      {
        key: 'carbs',
        label: 'Cơm / mì',
        defaultLevel: 3,
        anchors: [
          { level: 0, label: 'bỏ cơm', carbohydrateG: 0 },
          { level: 10, label: 'nhiều cơm + mì', carbohydrateG: 150 },
        ],
      },
      {
        key: 'fat',
        label: 'Độ béo',
        defaultLevel: 5,
        anchors: [
          { level: 0, label: 'thịt nạc, nướng', fatG: 0 },
          { level: 5, label: 'ba chỉ + đồ chiên', fatG: 40 },
          { level: 10, label: 'mỡ + chiên + kem', fatG: 90 },
        ],
      },
      {
        key: 'drinks',
        label: 'Đồ uống',
        defaultLevel: 0,
        anchors: [
          { level: 0, label: 'không uống', carbohydrateG: 0, alcoholG: 0 },
          {
            level: 10,
            label: 'nước ngọt + vài lon bia',
            carbohydrateG: 50,
            alcoholG: 40,
          },
        ],
      },
    ],
  };
}

describe('clampLevel', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clampLevel(-3)).toBe(0);
    expect(clampLevel(15)).toBe(10);
    expect(clampLevel(Number.NaN)).toBe(0);
    expect(clampLevel(4)).toBe(4);
  });
});

describe('defaultLevels', () => {
  it('reads each slider defaultLevel', () => {
    expect(defaultLevels(makeSpec())).toEqual({
      protein: 5,
      carbs: 3,
      fat: 5,
      drinks: 0,
    });
  });
});

describe('resolveSliderNutrition', () => {
  it('sums orthogonal axes and derives calories with the 4/4/9/7 identity', () => {
    const spec = makeSpec();
    const result = resolveSliderNutrition(spec, {
      protein: 5, // 60g
      carbs: 0, // 0g
      fat: 5, // 40g
      drinks: 0, // none
    });
    expect(result.proteinG).toBe(60);
    expect(result.carbohydrateG).toBe(0);
    expect(result.fatG).toBe(40);
    expect(result.alcoholG).toBe(0);
    // 4*60 + 4*0 + 9*40 + 7*0 = 240 + 360 = 600
    expect(result.caloriesKcal).toBe(600);
  });

  it('interpolates linearly between sparse anchors', () => {
    const spec = makeSpec();
    // carbs at level 5 → halfway between 0g (L0) and 150g (L10) = 75g
    const result = resolveSliderNutrition(spec, { carbs: 5 });
    expect(result.carbohydrateG).toBe(75);
  });

  it('folds drink sugar into carbs and counts alcohol energy', () => {
    const spec = makeSpec();
    const result = resolveSliderNutrition(spec, {
      protein: 0,
      carbs: 0,
      fat: 0,
      drinks: 10, // +50g carbs, +40g alcohol
    });
    expect(result.carbohydrateG).toBe(50);
    expect(result.alcoholG).toBe(40);
    // 4*50 + 7*40 = 200 + 280 = 480
    expect(result.caloriesKcal).toBe(480);
  });

  it('falls back to defaultLevel when a level is omitted', () => {
    const spec = makeSpec();
    const withDefaults = resolveSliderNutrition(spec, {});
    const explicit = resolveSliderNutrition(spec, defaultLevels(spec));
    expect(withDefaults).toEqual(explicit);
  });

  it('clamps levels beyond the anchor span to edge values', () => {
    const spec = makeSpec();
    const result = resolveSliderNutrition(spec, { protein: 99 });
    expect(result.proteinG).toBe(120);
  });
});

describe('activeAnchorLabel', () => {
  it('returns the nearest anchor label at or below the level', () => {
    const spec = makeSpec();
    const protein = spec.sliders[0];
    expect(activeAnchorLabel(protein, 0)).toBe('không ăn thịt');
    expect(activeAnchorLabel(protein, 4)).toBe('không ăn thịt');
    expect(activeAnchorLabel(protein, 5)).toBe('phần BBQ bình thường');
    expect(activeAnchorLabel(protein, 9)).toBe('phần BBQ bình thường');
    expect(activeAnchorLabel(protein, 10)).toBe('tiệc thịt');
  });
});
