import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the day reads run on the `db` singleton only.
// ---------------------------------------------------------------------------

const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));

vi.mock('@/lib/infra/auth/session', async () => {
  const { MOCK_USER, MOCK_PROFILE } = await import('./meal-doubles');
  return {
    requireAuthAndProfile: vi
      .fn()
      .mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE }),
  };
});

vi.mock('@/lib/infra/db', () => ({
  db: {
    transaction: vi.fn(),
    select: mockDbSelect,
    delete: vi.fn(),
    selectDistinctOn: vi.fn(),
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./meal-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  loadMealDates,
  loadMealsByDate,
  loadPendingAnalysesByDate,
} from '@/lib/actions/meals/load-meals';
import {
  LOGGED_AT,
  samplePipelineResult,
  UUID_1,
  UUID_2,
  UUID_MEAL,
} from './meal-doubles';

describe('loadMealsByDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns flat persisted nutrition for meals, groups, and ingredients', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: UUID_MEAL,
                rawInput: 'Phở bò',
                mealSlot: 'lunch',
                confidenceOverall: 'high',
                loggedAt: new Date('2026-04-06T12:00:00.000Z'),
                caloriesKcal: 830,
                proteinG: 34,
                carbohydrateG: 125,
                fatG: 18,
                sodiumMg: 240,
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              mealId: UUID_MEAL,
              ingredientName: 'Bánh phở',
              mealItemName: 'Phở bò',
              mealItemOrder: 0,
              foodCompositionId: 'fc-1',
              estimatedGrams: 400,
              userFacingUnit: '1 tô',
              cookingMethod: 'luộc',
              matchConfidence: 0.9,
              caloriesKcal: 620,
              proteinG: 9,
              carbohydrateG: 125,
              fatG: 5,
              sodiumMg: 240,
            },
            {
              id: UUID_2,
              mealId: UUID_MEAL,
              ingredientName: 'Thịt bò',
              mealItemName: 'Phở bò',
              mealItemOrder: 0,
              foodCompositionId: 'fc-2',
              estimatedGrams: 100,
              userFacingUnit: null,
              cookingMethod: 'luộc',
              matchConfidence: 0.85,
              caloriesKcal: 210,
              proteinG: 25,
              carbohydrateG: null,
              fatG: 13,
              sodiumMg: null,
            },
          ]),
        }),
      })
      // Third select: the per-meal share lookup. No share for this meal.
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

    const meals = await loadMealsByDate({
      date: '2026-04-06',
      timezoneOffset: 0,
    });

    expect(meals).toHaveLength(1);
    expect(meals[0]?.nutrition.caloriesKcal).toBe(830);
    expect(meals[0]?.nutrition.proteinG).toBe(34);
    expect(meals[0]?.mealItemGroups[0]?.nutrition.caloriesKcal).toBe(830);
    expect(meals[0]?.mealItemGroups[0]?.nutrition.sodiumMg).toBe(240);
    expect(
      meals[0]?.mealItemGroups[0]?.ingredients[0]?.nutrition.proteinG
    ).toBe(9);
  });
});

describe('loadPendingAnalysesByDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending confirmations scoped to the selected local day', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              rawInput: 'Phở bò',
              loggedAt: LOGGED_AT,
              pipelineResult: samplePipelineResult,
            },
          ]),
        }),
      }),
    });

    const pending = await loadPendingAnalysesByDate({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(UUID_1);
    expect(pending[0]?.rawInput).toBe('Phở bò');
    expect(pending[0]?.loggedAt).toBe(LOGGED_AT.toISOString());
    expect(pending[0]?.parsedMeal?.mealName).toBe('Phở bò');
    expect(pending[0]?.parsedMeal?.items[0]?.unit).toBe('g');
    expect(pending[0]?.parsedMeal?.items[0]?.vessel).toBeUndefined();
  });

  it('does not hide a staged meal once its expiry has passed', async () => {
    // The 30-minute window used to take an unconfirmed card off screen while
    // the user still meant to save it. It never gated confirmability —
    // confirmAndSaveMealAction deletes by (id, userId) and never reads
    // expiresAt — and it is not what dedupes re-analysis either: that is the
    // (user_id, attempt_id) upsert. So the day query must not mention it.
    const where = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue([]),
    });
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where }),
    });

    await loadPendingAnalysesByDate({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    const predicate = JSON.stringify(where.mock.calls[0]?.[0]);
    expect(predicate).toContain('pendingAnalyses.loggedAt');
    expect(predicate).not.toContain('expiresAt');
  });

  it('returns a cheat pending row as cheatSpec without crashing on missing mealItems', async () => {
    const spec = {
      sliders: [
        {
          key: 'protein',
          label: 'Thịt / hải sản',
          defaultLevel: 5,
          anchors: [
            { level: 0, label: 'không' },
            { level: 10, label: 'rất nhiều' },
          ],
        },
      ],
      mealSlot: 'dinner',
      confidence: 'medium',
    };
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              rawInput: 'Tiệc nướng',
              loggedAt: LOGGED_AT,
              entryMode: 'cheat',
              pipelineResult: { entryMode: 'cheat', spec },
            },
          ]),
        }),
      }),
    });

    const pending = await loadPendingAnalysesByDate({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(pending).toHaveLength(1);
    expect(pending[0]?.cheatSpec).toEqual(spec);
    expect(pending[0]?.parsedMeal).toBeUndefined();
  });

  it('skips malformed legacy rows instead of failing the whole day load', async () => {
    // Pending rows whose stored pipelineResult predates the current shape must
    // not throw and 500 the logging-day load. toParsedMeal walks mealItems →
    // each item's ingredients → displayedNutrition, so all of these legacy
    // shapes are skipped (not just a missing `mealItems`); valid rows still load.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: UUID_1,
              rawInput: 'Cơm tấm',
              loggedAt: LOGGED_AT,
              // No mealItems at all.
              pipelineResult: { legacy: true },
            },
            {
              id: UUID_MEAL,
              rawInput: 'Bún chả',
              loggedAt: LOGGED_AT,
              // Has mealItems, but each item is missing ingredients +
              // displayedNutrition — passes a shallow array check, throws deeper.
              pipelineResult: { mealItems: [{ name: 'Bún chả' }] },
            },
            {
              id: UUID_2,
              rawInput: 'Phở bò',
              loggedAt: LOGGED_AT,
              pipelineResult: samplePipelineResult,
            },
          ]),
        }),
      }),
    });

    const pending = await loadPendingAnalysesByDate({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe(UUID_2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});

describe('loadMealDates', () => {
  it('returns merged confirmed and pending dates', async () => {
    const { db } = await import('@/lib/infra/db');
    (db.selectDistinctOn as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi
              .fn()
              .mockResolvedValue([
                { date: '2026-04-06' },
                { date: '2026-04-05' },
              ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi
              .fn()
              .mockResolvedValue([
                { date: '2026-04-07' },
                { date: '2026-04-06' },
              ]),
          }),
        }),
      });

    const dates = await loadMealDates({ timezoneOffset: 0 });
    expect(dates).toEqual(['2026-04-07', '2026-04-06', '2026-04-05']);
  });
});
