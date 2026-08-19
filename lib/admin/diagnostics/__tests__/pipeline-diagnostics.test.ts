import { describe, expect, it } from 'vitest';
import { derivePipelineDiagnostics } from '../pipeline-diagnostics';
import type { LlmCall, StageLog } from '../types';

/**
 * The v2 pipeline is the default, but the summary only ever knew the v1 stage
 * shapes: `{ matched, unmatched }` for matching and `ingredients[].name` for
 * decomposition. Both safeParses failed on every v2 trace, so the panel showed
 * a parse fallback and a header reading "0 matched · 0 unmatched" no matter
 * what retrieval returned — which is how a real zero-candidate ingredient and
 * a perfectly matched one looked identical.
 */

function stage(
  name: string,
  stageIndex: number,
  outputJson: unknown
): StageLog {
  return {
    id: `sl-${name}`,
    requestId: 'req-1',
    stage: name,
    stageIndex,
    inputJson: null,
    outputJson,
    status: 'success',
    error: null,
    durationMs: 10,
    createdAt: new Date(0),
  } as StageLog;
}

const NO_LLM_CALLS: LlmCall[] = [];

const v2Decomposition = {
  isFood: true,
  mealSlot: 'breakfast',
  mealItems: [
    {
      name: 'Mì gói sữa',
      cookingMethod: 'nấu',
      ingredients: [
        { rawName: 'mì gói', canonicalName: 'Mì gói' },
        { rawName: 'sữa tươi', canonicalName: 'Sữa bò tươi' },
      ],
    },
  ],
};

// Flat index 0 = mì gói (nothing cleared the thresholds), 1 = sữa tươi.
const v2Matching = [
  { ingredientIndex: 0, candidates: [] },
  {
    ingredientIndex: 1,
    candidates: [
      {
        info: {
          ingredientName: 'Sữa bò tươi',
          foodCompositionId: 'fao_vn_2007_10001_raw',
          matchedName: 'Sữa bò tươi',
          similarity: 0.93,
          confidence: 'high',
          state: 'raw',
          matchType: 'vector',
          source: 'fao',
        },
        nutrition: { caloriesKcal: 74 },
        inediblePct: null,
      },
      {
        info: {
          ingredientName: 'Sữa bò tươi',
          foodCompositionId: 'usda_01077_raw',
          matchedName: 'Sữa nguyên kem',
          similarity: 0.81,
          confidence: 'medium',
          state: 'raw',
          matchType: 'fuzzy',
          source: 'usda',
        },
        nutrition: { caloriesKcal: 61 },
        inediblePct: null,
      },
    ],
  },
];

describe('derivePipelineDiagnostics — v2 stage shapes', () => {
  const diagnostics = derivePipelineDiagnostics(
    [
      stage('decomposition', 1, v2Decomposition),
      stage('matching', 2, v2Matching),
    ],
    NO_LLM_CALLS
  );

  it('parses a v2 decomposition via rawName', () => {
    expect(diagnostics.decomp.success).toBe(true);
    expect(diagnostics.totalIngredients).toBe(2);
    expect(diagnostics.mealItems[0].ingredients.map((i) => i.name)).toEqual([
      'mì gói',
      'sữa tươi',
    ]);
  });

  it('parses a v2 matching array instead of falling back', () => {
    expect(diagnostics.matching.success).toBe(true);
    expect(diagnostics.matchingPipeline).toBe('v2');
  });

  it('counts ingredients retrieval found candidates for', () => {
    expect(diagnostics.matchedCount).toBe(1);
    expect(diagnostics.matchRate).toBe(0.5);
  });

  it('reports an EMPTY candidate pool, not a missing one', () => {
    const rows = diagnostics.rowsByMeal.get('Mì gói sữa');
    const miGoi = rows?.[0];
    expect(miGoi?.ingredientName).toBe('mì gói');
    expect(miGoi?.confidence).toBe('unmatched');
    // The distinction the whole panel turns on: `[]` means retrieval ran and
    // returned nothing; `undefined` would mean the trace never logged a pool.
    expect(miGoi?.candidates).toEqual([]);
  });

  it('surfaces the full pool, best-first, for an ingredient that matched', () => {
    const sua = diagnostics.rowsByMeal.get('Mì gói sữa')?.[1];
    expect(sua?.matchedName).toBe('Sữa bò tươi');
    expect(sua?.similarity).toBeCloseTo(0.93);
    expect(sua?.candidates).toHaveLength(2);
    expect(sua?.candidates?.[1].matchedName).toBe('Sữa nguyên kem');
    expect(sua?.candidates?.[1].source).toBe('usda');
  });

  it('joins by flat index, so ingredient order survives across meal items', () => {
    const twoItems = derivePipelineDiagnostics(
      [
        stage('decomposition', 1, {
          isFood: true,
          mealItems: [
            {
              name: 'A',
              cookingMethod: 'luộc',
              ingredients: [{ rawName: 'a1', canonicalName: 'A1' }],
            },
            {
              name: 'B',
              cookingMethod: 'luộc',
              ingredients: [{ rawName: 'b1', canonicalName: 'B1' }],
            },
          ],
        }),
        stage('matching', 2, [
          { ingredientIndex: 0, candidates: [] },
          {
            ingredientIndex: 1,
            candidates: [
              {
                info: {
                  ingredientName: 'B1',
                  foodCompositionId: 'fc-b',
                  matchedName: 'B one',
                  similarity: 0.9,
                  confidence: 'high',
                },
              },
            ],
          },
        ]),
      ],
      NO_LLM_CALLS
    );
    expect(twoItems.rowsByMeal.get('A')?.[0].candidates).toEqual([]);
    expect(twoItems.rowsByMeal.get('B')?.[0].matchedName).toBe('B one');
  });

  it('leaves candidates UNDEFINED when the stage has no record for the index', () => {
    // A truncated/partial matching stage must not be reported as "retrieval
    // ran and returned nothing" — that is a different, and much louder,
    // diagnosis than "this trace never logged the ingredient".
    const partial = derivePipelineDiagnostics(
      [
        stage('decomposition', 1, v2Decomposition),
        // Only flat index 1 was logged; index 0 (mì gói) is absent entirely.
        stage('matching', 2, [v2Matching[1]]),
      ],
      NO_LLM_CALLS
    );
    const rows = partial.rowsByMeal.get('Mì gói sữa');
    expect(rows?.[0].candidates).toBeUndefined();
    expect(rows?.[0].confidence).toBe('unmatched');
    expect(rows?.[1].matchedName).toBe('Sữa bò tươi');
  });

  it('carries the top candidate viaAlias flag into the row and the header', () => {
    const aliased = derivePipelineDiagnostics(
      [
        stage('decomposition', 1, {
          isFood: true,
          mealItems: [
            {
              name: 'Bánh mì',
              cookingMethod: 'nướng',
              ingredients: [{ rawName: 'bánh mì', canonicalName: 'Bánh mì' }],
            },
          ],
        }),
        stage('matching', 2, [
          {
            ingredientIndex: 0,
            candidates: [
              {
                info: {
                  ingredientName: 'Bánh mì',
                  foodCompositionId: 'fao_vn_2007_1012_raw',
                  matchedName: 'Bánh mỳ',
                  similarity: 1,
                  confidence: 'high',
                  matchType: 'fuzzy',
                  viaAlias: true,
                },
              },
            ],
          },
        ]),
      ],
      NO_LLM_CALLS
    );
    expect(aliased.rowsByMeal.get('Bánh mì')?.[0].viaAlias).toBe(true);
    expect(aliased.matchStrategyCounts.alias).toBe(1);
  });
});

describe('derivePipelineDiagnostics — v1 stage shapes still parse', () => {
  const diagnostics = derivePipelineDiagnostics(
    [
      stage('decomposition', 1, {
        isFood: true,
        mealItems: [
          {
            name: 'Cơm gà',
            ingredients: [{ name: 'cơm', estimatedGrams: 200 }],
          },
        ],
      }),
      stage('matching', 2, {
        matched: [
          {
            ingredientName: 'cơm',
            matchedName: 'Gạo tẻ',
            similarity: 0.88,
            confidence: 'high',
            matchType: 'vector',
            source: 'fao',
            viaAlias: true,
          },
        ],
        unmatched: [{ ingredientName: 'nước mắm' }],
      }),
    ],
    NO_LLM_CALLS
  );

  it('keeps the v1 name-join path and its grams', () => {
    expect(diagnostics.matchingPipeline).toBe('v1');
    const row = diagnostics.rowsByMeal.get('Cơm gà')?.[0];
    expect(row?.matchedName).toBe('Gạo tẻ');
    expect(row?.grams).toBe(200);
    expect(row?.viaAlias).toBe(true);
    // v1 never logged a pool — undefined, so the renderer shows no "0
    // candidates" notice on a trace that simply predates the feature.
    expect(row?.candidates).toBeUndefined();
  });

  it('still lists unmatched output not represented in the decomposition', () => {
    expect(diagnostics.unmatchedOutputRows).toHaveLength(1);
    expect(diagnostics.matchStrategyCounts).toEqual({
      vector: 1,
      fuzzy: 0,
      alias: 1,
    });
  });
});
