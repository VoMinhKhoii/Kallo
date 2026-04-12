import { describe, expect, it } from 'vitest';
import { NULL_BOUNDED_NUTRITION } from '@/lib/ai/__tests__/test-helpers';
import { goalAdjustNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import type { BoundedNutrition } from '@/lib/ai/types';

// useDisplayedMacros is a thin wrapper around goalAdjustNutrition + useMemo.
// We test the core logic directly since hook wrappers add no logic.

function makeBounded(
  overrides: Partial<
    Record<keyof BoundedNutrition, { low: number; mid: number; high: number }>
  > = {}
): BoundedNutrition {
  const result = { ...NULL_BOUNDED_NUTRITION };
  for (const key of Object.keys(overrides) as (keyof BoundedNutrition)[]) {
    (result as Record<string, unknown>)[key] = overrides[key]!;
  }
  return result;
}

describe('goal adjustment for displayed macros', () => {
  it('should return mid values when maintaining (aggression=0)', () => {
    const bounded = makeBounded({
      caloriesKcal: { low: 400, mid: 500, high: 600 },
      proteinG: { low: 20, mid: 25, high: 30 },
      carbohydrateG: { low: 50, mid: 60, high: 70 },
      fatG: { low: 10, mid: 15, high: 20 },
    });

    const result = goalAdjustNutrition(bounded, 'maintaining', 0);

    expect(result.caloriesKcal).toBe(500);
    expect(result.proteinG).toBe(25);
    expect(result.carbohydrateG).toBe(60);
    expect(result.fatG).toBe(15);
  });

  it('should shift toward high bound for calories when cutting', () => {
    const bounded = makeBounded({
      caloriesKcal: { low: 400, mid: 500, high: 600 },
    });

    // Cutting with aggression=0.5: displayed = 500 + 0.5 * (600 - 500) = 550
    const result = goalAdjustNutrition(bounded, 'cutting', 0.5);
    expect(result.caloriesKcal).toBe(550);
  });

  it('should shift toward low bound for protein when cutting', () => {
    const bounded = makeBounded({
      proteinG: { low: 20, mid: 25, high: 30 },
    });

    // Cutting: protein uses low bound → displayed = 25 + 0.5 * (20 - 25) = 22.5
    const result = goalAdjustNutrition(bounded, 'cutting', 0.5);
    expect(result.proteinG).toBe(22.5);
  });

  it('should shift toward low bound for calories when bulking', () => {
    const bounded = makeBounded({
      caloriesKcal: { low: 400, mid: 500, high: 600 },
    });

    // Bulking: calories uses low bound → displayed = 500 + 0.5 * (400 - 500) = 450
    const result = goalAdjustNutrition(bounded, 'bulking', 0.5);
    expect(result.caloriesKcal).toBe(450);
  });

  it('should not adjust micronutrients regardless of goal', () => {
    const bounded = makeBounded({
      sodiumMg: { low: 100, mid: 200, high: 300 },
      calciumMg: { low: 50, mid: 100, high: 150 },
    });

    const result = goalAdjustNutrition(bounded, 'cutting', 0.8);
    expect(result.sodiumMg).toBe(200); // Always mid
    expect(result.calciumMg).toBe(100); // Always mid
  });

  it('should handle null nutrition values', () => {
    const bounded = NULL_BOUNDED_NUTRITION;
    const result = goalAdjustNutrition(bounded, 'cutting', 0.5);

    expect(result.caloriesKcal).toBeNull();
    expect(result.proteinG).toBeNull();
  });
});
