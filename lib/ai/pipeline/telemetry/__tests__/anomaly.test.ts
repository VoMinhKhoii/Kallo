import { describe, expect, it } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__fixtures__/test-helpers';
import {
  type AnomalyCause,
  classifyV2Anomalies,
  rederiveKcal,
  summarizeV2Anomalies,
  V2_ANOMALY_THRESHOLDS,
} from '@/lib/ai/pipeline/telemetry/anomaly';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { BoundedEstimate } from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function triple(low: number, mid: number, high: number): BoundedEstimate {
  return { low, mid, high };
}

function makeIngredient(
  overrides: Partial<ProcessedIngredient> & { ingredientName: string }
): ProcessedIngredient {
  const kcal =
    overrides.boundedNutrition?.caloriesKcal ?? triple(240, 300, 360);
  return {
    foodCompositionId: 'fc-1',
    estimatedGrams: 100,
    rawEquivalentGrams: 100,
    cookingMethod: null,
    userFacingUnit: null,
    matchConfidence: 0.9,
    boundedNutrition: {
      ...NULL_BOUNDED_NUTRITION,
      caloriesKcal: kcal,
      proteinG: triple(4, 6, 8),
      carbohydrateG: triple(50, 65, 80),
      fatG: triple(0.5, 1, 1.5),
    },
    displayedNutrition: { ...NULL_NUTRITION_VALUES },
    ...overrides,
  };
}

function makeResult(ingredients: ProcessedIngredient[]): PipelineResult {
  return {
    mealItems: [
      {
        name: 'Cơm',
        ingredients,
        boundedNutrition: { ...NULL_BOUNDED_NUTRITION },
        displayedNutrition: { ...NULL_NUTRITION_VALUES },
      },
    ],
    mealSlot: 'lunch',
    confidenceOverall: 'high',
    boundedNutrition: { ...NULL_BOUNDED_NUTRITION },
    displayedNutrition: { ...NULL_NUTRITION_VALUES },
    unmatchedIngredients: [],
  };
}

function makeMatched(
  name: string,
  over: Partial<MatchedIngredient> = {}
): MatchedIngredient {
  return {
    ingredientId: `id-${name}`,
    ingredientName: name,
    foodCompositionId: 'fc-1',
    matchedName: `DB ${name}`,
    similarity: 0.9,
    confidence: 'high',
    nutritionPer100g: { ...NULL_NUTRITION_VALUES, caloriesKcal: 200 },
    dbState: 'raw',
    ...over,
  };
}

const NO_PREP = new Set<string>();

// ---------------------------------------------------------------------------
// Classification per cause
// ---------------------------------------------------------------------------

describe('classifyV2Anomalies — cause classification', () => {
  it('returns no correctness anomalies for a clean matched ingredient', () => {
    // kcal 300, macros 6P+65C+1F = 24+260+9 = 293 → ~2% dev < 20%.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Gạo tẻ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(240, 293, 360),
          proteinG: triple(4, 6, 8),
          carbohydrateG: triple(50, 65, 80),
          fatG: triple(0.5, 1, 1.5),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Gạo tẻ')],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    const causes = anomalies.map((a) => a.cause);
    expect(causes).not.toContain('macro_inconsistent');
    expect(causes).not.toContain('implausible_grams');
    expect(causes).not.toContain('wrong_row');
  });

  it('flags implausible_grams below the physical floor → flag_only (advisory, never auto-clarifies)', () => {
    const result = makeResult([
      makeIngredient({ ingredientName: 'Muối', estimatedGrams: 0.2 }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Muối')],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    const g = anomalies.find((a) => a.cause === 'implausible_grams');
    expect(g).toBeDefined();
    expect(g?.action).toBe('flag_only');
  });

  it('flags implausible_grams above the physical ceiling', () => {
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Cơm',
        estimatedGrams: V2_ANOMALY_THRESHOLDS.MAX_GRAMS + 1,
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Cơm')],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    expect(anomalies.some((a) => a.cause === 'implausible_grams')).toBe(true);
  });

  it('classifies macro_inconsistent as flag_only (assembly owns re-derivation)', () => {
    // kcal 500, macros 6P+65C+1F = 293 → 41% dev > 20%.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Gạo tẻ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(450, 500, 550),
          proteinG: triple(4, 6, 8),
          carbohydrateG: triple(50, 65, 80),
          fatG: triple(0.5, 1, 1.5),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Gạo tẻ')],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    const m = anomalies.find((a) => a.cause === 'macro_inconsistent');
    expect(m).toBeDefined();
    expect(m?.action).toBe('flag_only');
  });

  it('classifies macro_inconsistent on an UNMATCHED ingredient as flag_only (LLM owns macros)', () => {
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Sốt lạ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(450, 500, 550),
          proteinG: triple(4, 6, 8),
          carbohydrateG: triple(50, 65, 80),
          fatG: triple(0.5, 1, 1.5),
        },
      }),
    ]);
    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'Sốt lạ', mealContext: 'Cơm' },
    ];
    const anomalies = classifyV2Anomalies({
      result,
      matched: [],
      unmatched,
      prepNoteIngredientNames: NO_PREP,
    });
    const m = anomalies.find((a) => a.cause === 'macro_inconsistent');
    expect(m?.action).toBe('flag_only');
  });

  it('flags a too-wide unmatched interval as interval_widened (warning), never a clarify', () => {
    // mid 300, low 50, high 800 → width 750, ratio 2.5 > 1.5.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Sốt lạ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(50, 300, 800),
          proteinG: triple(0, 6, 12),
          carbohydrateG: triple(0, 65, 130),
          fatG: triple(0, 1, 3),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [],
      unmatched: [{ ingredientName: 'Sốt lạ', mealContext: 'Cơm' }],
      prepNoteIngredientNames: NO_PREP,
    });
    // A too-wide interval is telemetered at warning severity but never routes
    // to a clarify — the estimate ships and the picker corrects the portion.
    const u = anomalies.find(
      (a) =>
        a.cause === 'unmatched_high_uncertainty' &&
        a.action === 'interval_widened' &&
        a.severity === 'warning'
    );
    expect(u).toBeDefined();
  });

  it('records interval_widened (info) for an unmatched ingredient within the width band', () => {
    // mid 300, low 260, high 340 → width 80, ratio 0.27 < 1.5.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Sốt lạ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(260, 300, 340),
          proteinG: triple(4, 6, 8),
          carbohydrateG: triple(60, 65, 70),
          fatG: triple(0.5, 1, 1.5),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [],
      unmatched: [{ ingredientName: 'Sốt lạ', mealContext: 'Cơm' }],
      prepNoteIngredientNames: NO_PREP,
    });
    const u = anomalies.find((a) => a.cause === 'unmatched_high_uncertainty');
    expect(u?.action).toBe('interval_widened');
    expect(u?.severity).toBe('info');
  });

  it('flags wrong_row (matched density > pure fat) as escalation_candidate WITHOUT clamping', () => {
    // 100 g, kcal 1000 → density 1000/100g > 900 ceiling.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Rau',
        estimatedGrams: 100,
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(950, 1000, 1050),
          proteinG: triple(0, 1, 2),
          carbohydrateG: triple(0, 1, 2),
          fatG: triple(100, 110, 120),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Rau', { matchedName: 'Dầu ăn' })],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    const w = anomalies.find((a) => a.cause === 'wrong_row');
    expect(w).toBeDefined();
    expect(w?.action).toBe('escalation_candidate');
    // Numbers are NOT mutated by the classifier (no blind clamp).
    expect(
      result.mealItems[0].ingredients[0].boundedNutrition.caloriesKcal
    ).toEqual(triple(950, 1000, 1050));
  });

  it('flags wrong_state (dbState unknown) as flag_only', () => {
    const result = makeResult([makeIngredient({ ingredientName: 'Gạo tẻ' })]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Gạo tẻ', { dbState: 'unknown' })],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    const s = anomalies.find((a) => a.cause === 'wrong_state');
    expect(s?.action).toBe('flag_only');
  });

  it('classifies a consistent prep-note-unlocked matched ingredient as legit_prep_adjustment (not an anomaly)', () => {
    // kcal consistent with macros → no macro_inconsistent; prep note present.
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Đùi gà',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: triple(150, 160, 170),
          proteinG: triple(24, 25, 26),
          carbohydrateG: triple(0, 0, 0),
          fatG: triple(6, 6.7, 7),
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Đùi gà')],
      unmatched: [],
      prepNoteIngredientNames: new Set(['Đùi gà']),
    });
    const legit = anomalies.find((a) => a.cause === 'legit_prep_adjustment');
    expect(legit).toBeDefined();
    expect(legit?.action).toBe('none');
    expect(anomalies.some((a) => a.cause === 'macro_inconsistent')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// kcal re-derivation (the deterministic SAFE action)
// ---------------------------------------------------------------------------

describe('rederiveKcal', () => {
  it('re-derives kcal from 4P + 4C + 9F per bound', () => {
    const out = rederiveKcal({
      proteinG: triple(4, 6, 8),
      carbohydrateG: triple(50, 65, 80),
      fatG: triple(0.5, 1, 1.5),
    });
    // mid: 4*6 + 4*65 + 9*1 = 24 + 260 + 9 = 293
    expect(out.mid).toBe(293);
    // low: 4*4 + 4*50 + 9*0.5 = 16 + 200 + 4.5 = 220.5
    expect(out.low).toBe(220.5);
    // high: 4*8 + 4*80 + 9*1.5 = 32 + 320 + 13.5 = 365.5
    expect(out.high).toBe(365.5);
  });

  it('a re-derived matched ingredient no longer trips macro_inconsistent', () => {
    const protein = triple(4, 6, 8);
    const carb = triple(50, 65, 80);
    const fat = triple(0.5, 1, 1.5);
    const rederived = rederiveKcal({
      proteinG: protein,
      carbohydrateG: carb,
      fatG: fat,
    });
    const result = makeResult([
      makeIngredient({
        ingredientName: 'Gạo tẻ',
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: rederived,
          proteinG: protein,
          carbohydrateG: carb,
          fatG: fat,
        },
      }),
    ]);
    const anomalies = classifyV2Anomalies({
      result,
      matched: [makeMatched('Gạo tẻ')],
      unmatched: [],
      prepNoteIngredientNames: NO_PREP,
    });
    expect(anomalies.some((a) => a.cause === 'macro_inconsistent')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Summary + telemetry markers
// ---------------------------------------------------------------------------

describe('summarizeV2Anomalies', () => {
  it('counts per cause + action and emits markers only for non-zero causes', () => {
    const anomalies = [
      {
        cause: 'wrong_row' as AnomalyCause,
        action: 'escalation_candidate' as const,
        severity: 'warning' as const,
        message: '',
        ingredientName: 'a',
        mealItemName: 'm',
      },
      {
        cause: 'macro_inconsistent' as AnomalyCause,
        action: 'kcal_rederived' as const,
        severity: 'warning' as const,
        message: '',
        ingredientName: 'b',
        mealItemName: 'm',
      },
      {
        cause: 'macro_inconsistent' as AnomalyCause,
        action: 'flag_only' as const,
        severity: 'warning' as const,
        message: '',
        ingredientName: 'c',
        mealItemName: 'm',
      },
    ];
    const summary = summarizeV2Anomalies(anomalies);
    expect(summary.causeCounts.macro_inconsistent).toBe(2);
    expect(summary.causeCounts.wrong_row).toBe(1);
    expect(summary.causeCounts.wrong_state).toBe(0);
    expect(summary.actionCounts.kcal_rederived).toBe(1);
    expect(summary.hasEscalationCandidate).toBe(true);
    expect(summary.markers).toContain('v2_cause_wrong_row_1');
    expect(summary.markers).toContain('v2_cause_macro_inconsistent_2');
    expect(summary.markers).not.toContain('v2_cause_wrong_state_0');
  });

  it('reports no escalation candidate when none present', () => {
    const summary = summarizeV2Anomalies([
      {
        cause: 'wrong_state',
        action: 'flag_only',
        severity: 'info',
        message: '',
        ingredientName: 'a',
        mealItemName: 'm',
      },
    ]);
    expect(summary.hasEscalationCandidate).toBe(false);
  });
});
