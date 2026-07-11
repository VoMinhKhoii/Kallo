import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockGemini,
  createSourceAwareMockDb,
} from '../../__tests__/test-helpers';
import type { StreamEvent } from '../../streaming/types';
import type { UserContext } from '../../types';
import { analyzeMealV2 } from '../grounded-orchestrator';
import type { GroundedEstimation, MealDecompositionV2 } from '../schemas-v2';

afterEach(() => {
  vi.restoreAllMocks();
});

const userContext: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

/**
 * Build a Gemini mock where each `generateStructuredOutputStream` call:
 *  - Synchronously feeds the matching `chunks` to `onChunk(accumulated)`
 *    (simulating the streaming text arriving from the model).
 *  - Resolves to the corresponding `final` parsed object.
 *
 * Calls are matched in order: first call = Call 1 (decomposition), second =
 * Call 2 (grounded).
 */
function geminiStreaming(
  call1: { chunks: string[]; final: MealDecompositionV2 },
  call2: { chunks: string[]; final: GroundedEstimation }
) {
  let invocation = 0;
  return createMockGemini({
    generateStructuredOutputStream: vi
      .fn()
      .mockImplementation(
        async (_params: unknown, opts?: { onChunk?: (s: string) => void }) => {
          const onChunk = opts?.onChunk;
          const cfg = invocation === 0 ? call1 : call2;
          invocation++;
          if (onChunk) {
            let accumulated = '';
            for (const chunk of cfg.chunks) {
              accumulated += chunk;
              onChunk(accumulated);
            }
          }
          return cfg.final;
        }
      ),
  });
}

function recordEvents() {
  const events: StreamEvent[] = [];
  return {
    events,
    emit: (event: StreamEvent) => events.push(event),
  };
}

describe('analyzeMealV2 — Call 1 item_name streaming', () => {
  it('emits item_name events as meal items appear in the partial JSON stream', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
        {
          name: 'đùi gà nướng',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'đùi gà', canonicalName: 'Đùi gà' }],
        },
      ],
    };
    const chunks = [
      '{"isFood":true,"mealSlot":"lunch","mealItems":[',
      '{"name":"cơm trắng","cookingMethod":"nấu","ingredients":[{"rawName":"cơm","canonicalName":"Cơm"}]},',
      '{"name":"đùi gà nướng","cookingMethod":"nướng","ingredients":[{"rawName":"đùi gà","canonicalName":"Đùi gà"}]}',
      ']}',
    ];

    const call2Final: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm trắng',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grams: 200,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'none',
              grams: 150,
              caloriesKcal: { low: 300, mid: 330, high: 360 },
              proteinG: { low: 35, mid: 36, high: 37 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 18, mid: 21, high: 24 },
            },
          ],
        },
      ],
    };
    const call2Chunks = [
      '{"mealItems":[',
      `${JSON.stringify(call2Final.mealItems[0])},`,
      JSON.stringify(call2Final.mealItems[1]),
      ']}',
    ];

    const gemini = geminiStreaming(
      { chunks, final: call1Final },
      { chunks: call2Chunks, final: call2Final }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    const result = await analyzeMealV2(
      'cơm trắng + 1 đùi gà nướng',
      userContext,
      db,
      gemini,
      emit
    );
    expect(result.success).toBe(true);

    const itemNameEvents = events.filter((e) => e.type === 'item_name');
    expect(itemNameEvents).toHaveLength(2);
    expect(itemNameEvents[0]).toMatchObject({
      type: 'item_name',
      name: 'Cơm trắng',
      index: 0,
    });
    expect(itemNameEvents[1]).toMatchObject({
      type: 'item_name',
      name: 'Đùi gà nướng',
      index: 1,
    });
    expect(itemNameEvents[0].mealItemId).toBeTruthy();
    expect(itemNameEvents[1].mealItemId).toBeTruthy();
    expect(itemNameEvents[0].mealItemId).not.toBe(itemNameEvents[1].mealItemId);
  });

  it('does NOT emit item_name for non-food input', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: false,
      mealSlot: null,
      mealItems: [],
    };
    const gemini = geminiStreaming(
      {
        chunks: ['{"isFood":false,"mealItems":[],"mealSlot":null}'],
        final: call1Final,
      },
      { chunks: [], final: { mealItems: [] } as unknown as GroundedEstimation }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    const result = await analyzeMealV2(
      'hello world',
      userContext,
      db,
      gemini,
      emit
    );
    expect(result.success).toBe(false);
    expect(events.filter((e) => e.type === 'item_name')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'item_macros')).toHaveLength(0);
  });

  it('keeps occurrence-based mealItemIds distinct for duplicate names', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'breakfast',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const chunks = [
      '{"isFood":true,"mealSlot":"breakfast","mealItems":[',
      '{"name":"cơm trắng","cookingMethod":"nấu","ingredients":[{"rawName":"cơm","canonicalName":"Cơm"}]},',
      '{"name":"cơm trắng","cookingMethod":"nấu","ingredients":[{"rawName":"cơm","canonicalName":"Cơm"}]}',
      ']}',
    ];
    const call2Final: GroundedEstimation = {
      mealItems: call1Final.mealItems.map((mi) => ({
        mealItemName: mi.name,
        ingredients: [
          {
            ingredientName: 'cơm',
            selectedCandidateId: 'none',
            grams: 200,
            caloriesKcal: { low: 250, mid: 260, high: 270 },
            proteinG: { low: 5, mid: 5, high: 5 },
            carbohydrateG: { low: 55, mid: 56, high: 57 },
            fatG: { low: 0.5, mid: 0.6, high: 0.7 },
          },
        ],
      })),
    };
    const gemini = geminiStreaming(
      { chunks, final: call1Final },
      {
        chunks: [
          '{"mealItems":[',
          `${JSON.stringify(call2Final.mealItems[0])},`,
          JSON.stringify(call2Final.mealItems[1]),
          ']}',
        ],
        final: call2Final,
      }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    await analyzeMealV2('cơm trắng x 2', userContext, db, gemini, emit);
    const itemNameEvents = events.filter((e) => e.type === 'item_name');
    expect(itemNameEvents).toHaveLength(2);
    expect(itemNameEvents[0].mealItemId).not.toBe(itemNameEvents[1].mealItemId);

    // Regression: previously, handleCall2Chunk hardcoded `::1` for occurrence
    // lookup, so the SECOND duplicate-name item resolved to the FIRST item's
    // mealItemId, hit itemMacrosStreamed.has(), and was silently skipped —
    // its macros only surfaced via flushUnstreamedItemMacros at the very
    // end, defeating progressive streaming. Both item_macros events MUST
    // arrive with distinct mealItemIds matching the item_name pair.
    const itemMacrosEvents = events.filter((e) => e.type === 'item_macros');
    expect(itemMacrosEvents).toHaveLength(2);
    const macroIds = new Set(itemMacrosEvents.map((e) => e.mealItemId));
    expect(macroIds.size).toBe(2);
    const nameIds = new Set(itemNameEvents.map((e) => e.mealItemId));
    expect(macroIds).toEqual(nameIds);
  });
});

describe('analyzeMealV2 — Call 2 item_macros streaming', () => {
  it('emits item_macros per meal item as Call 2 streams completed nutrition', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
        {
          name: 'đùi gà nướng',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'đùi gà', canonicalName: 'Đùi gà' }],
        },
      ],
    };
    const call2Final: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm trắng',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grams: 200,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'none',
              grams: 150,
              caloriesKcal: { low: 300, mid: 330, high: 360 },
              proteinG: { low: 35, mid: 36, high: 37 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 18, mid: 21, high: 24 },
            },
          ],
        },
      ],
    };
    const gemini = geminiStreaming(
      {
        chunks: [
          '{"isFood":true,"mealSlot":"lunch","mealItems":[',
          `${JSON.stringify(call1Final.mealItems[0])},`,
          JSON.stringify(call1Final.mealItems[1]),
          ']}',
        ],
        final: call1Final,
      },
      {
        chunks: [
          '{"mealItems":[',
          `${JSON.stringify(call2Final.mealItems[0])},`,
          JSON.stringify(call2Final.mealItems[1]),
          ']}',
        ],
        final: call2Final,
      }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    await analyzeMealV2(
      'cơm trắng + 1 đùi gà nướng',
      userContext,
      db,
      gemini,
      emit
    );

    const itemMacrosEvents = events.filter((e) => e.type === 'item_macros');
    expect(itemMacrosEvents).toHaveLength(2);
    // Stream order: first item_macros is for the meal item that completed first.
    expect(itemMacrosEvents[0].item.name).toBe('Cơm trắng');
    expect(itemMacrosEvents[1].item.name).toBe('Đùi gà nướng');
    // Macros must be non-zero (resolved from LLM unmatched verbatim).
    expect(itemMacrosEvents[0].item.macros.calories).toBeGreaterThan(0);
    expect(itemMacrosEvents[1].item.macros.calories).toBeGreaterThan(0);
  });

  it('reuses Call 1 streamed mealItemIds for item_macros events', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm trắng',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const call2Final: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm trắng',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grams: 200,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    const gemini = geminiStreaming(
      {
        chunks: [
          '{"isFood":true,"mealSlot":"lunch","mealItems":[',
          JSON.stringify(call1Final.mealItems[0]),
          ']}',
        ],
        final: call1Final,
      },
      {
        chunks: [
          '{"mealItems":[',
          JSON.stringify(call2Final.mealItems[0]),
          ']}',
        ],
        final: call2Final,
      }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    await analyzeMealV2('cơm trắng', userContext, db, gemini, emit);

    const itemNameEvent = events.find((e) => e.type === 'item_name');
    const itemMacrosEvent = events.find((e) => e.type === 'item_macros');
    expect(itemNameEvent?.mealItemId).toBeTruthy();
    expect(itemMacrosEvent?.mealItemId).toBeTruthy();
    expect(itemMacrosEvent?.mealItemId).toBe(itemNameEvent?.mealItemId);
  });

  it('flushes a single-item meal whose JSON has no trailing separator', async () => {
    // The regex-based streaming parser only completes a meal item when the
    // NEXT `{"mealItemName":` marker appears. With one item, that marker
    // never comes — so the orchestrator must emit on flush.
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'snack',
      mealItems: [
        {
          name: 'nem lụi',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'nem lụi', canonicalName: 'Nem lụi' }],
        },
      ],
    };
    const call2Final: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'nem lụi',
          ingredients: [
            {
              ingredientName: 'nem lụi',
              grams: 200,
              caloriesKcal: { low: 480, mid: 540, high: 600 },
              proteinG: { low: 28, mid: 32, high: 36 },
              carbohydrateG: { low: 4, mid: 5, high: 6 },
              fatG: { low: 28, mid: 34, high: 40 },
            },
          ],
        },
      ],
    };
    const gemini = geminiStreaming(
      {
        chunks: [
          '{"isFood":true,"mealSlot":"snack","mealItems":[',
          JSON.stringify(call1Final.mealItems[0]),
          ']}',
        ],
        final: call1Final,
      },
      {
        chunks: [
          '{"mealItems":[',
          JSON.stringify(call2Final.mealItems[0]),
          ']}',
        ],
        final: call2Final,
      }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    await analyzeMealV2('8 cây nem lụi', userContext, db, gemini, emit);

    const itemMacrosEvents = events.filter((e) => e.type === 'item_macros');
    expect(itemMacrosEvents).toHaveLength(1);
    expect(itemMacrosEvents[0].item.name).toBe('Nem lụi');
    // 8P + 9F = 32×4 + 5×4 + 34×9 = 128 + 20 + 306 = 454 — matches macro
    // identity from the LLM triples.
    expect(itemMacrosEvents[0].item.macros.calories).toBeCloseTo(454, 0);
  });

  it('does NOT emit duplicate item_macros for the same mealItemId', async () => {
    const call1Final: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'cơm',
          cookingMethod: 'nấu',
          ingredients: [{ rawName: 'cơm', canonicalName: 'Cơm' }],
        },
      ],
    };
    const call2Final: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'cơm',
          ingredients: [
            {
              ingredientName: 'cơm',
              selectedCandidateId: 'none',
              grams: 200,
              caloriesKcal: { low: 250, mid: 260, high: 270 },
              proteinG: { low: 5, mid: 5, high: 5 },
              carbohydrateG: { low: 55, mid: 56, high: 57 },
              fatG: { low: 0.5, mid: 0.6, high: 0.7 },
            },
          ],
        },
      ],
    };
    // Two chunks containing the same complete-meal-item marker → potential
    // for double-fire. The dedupe set inside the orchestrator must prevent it.
    const gemini = geminiStreaming(
      {
        chunks: [
          '{"isFood":true,"mealSlot":"lunch","mealItems":[',
          JSON.stringify(call1Final.mealItems[0]),
          ']}',
        ],
        final: call1Final,
      },
      {
        chunks: [
          '{"mealItems":[',
          JSON.stringify(call2Final.mealItems[0]),
          ']}',
        ],
        final: call2Final,
      }
    );
    const db = createSourceAwareMockDb({});
    const { events, emit } = recordEvents();

    await analyzeMealV2('cơm', userContext, db, gemini, emit);

    const itemMacrosEvents = events.filter((e) => e.type === 'item_macros');
    expect(itemMacrosEvents).toHaveLength(1);
  });
});
