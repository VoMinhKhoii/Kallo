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

vi.mock('@/lib/infra/db/client', () => ({
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

const { mockReap } = vi.hoisted(() => ({
  mockReap: vi
    .fn()
    .mockResolvedValue({ reapedIds: [], releasedInvites: false }),
}));
vi.mock('@/lib/actions/meals/day/reap-abandoned', () => ({
  reapAbandonedPendingAnalyses: mockReap,
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  loadLoggingDay,
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

  it('hides a card already past the reaping horizon', async () => {
    // The read and the sweep have to agree on where "abandoned" starts, and
    // agreeing AFTER the fact is not enough: two day loads can overlap for one
    // user (the dashboard route calls loadLoggingDay too), so load B can read a
    // row that load A's sweep deletes — and B's own sweep then reports nothing,
    // because A already took it. B would hand back a card that cannot be
    // confirmed or discarded. Drawing the same line in the read is what closes
    // that; no reconciliation between one read and one sweep can.
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
    expect(predicate).toContain("interval '7 days'");
    // Pinned to the operator on the expiresAt clause SPECIFICALLY, not to a
    // `>=` anywhere in the predicate: `loggedAt >= dayStart` sits right beside
    // it and satisfies the loose version, so `<` here — the read keeping the
    // doomed rows and discarding the live ones, which empties the feed and
    // shows only cards that cannot be confirmed — passed it.
    const operator = predicate.match(
      /pendingAnalyses\.expiresAt",\{"value":\["([^"]*)"\]/
    )?.[1];
    expect(operator).toBe(' >= now() - ');
  });

  it('does not hide a staged meal once its expiry has passed', async () => {
    // The 30-minute window used to take an unconfirmed card off screen while
    // the user still meant to save it. It never gated confirmability —
    // confirmAndSaveMealAction deletes by (id, userId) and never reads
    // expiresAt — and it is not what dedupes re-analysis either: that is the
    // (user_id, attempt_id) upsert.
    //
    // The read compares `expiresAt` again now, so "must not mention expiresAt"
    // would be a wrong reading of that: it draws the REAPING line, a week out,
    // and hides only rows that are about to stop existing. What must never
    // come back is a comparison against a bare `now()`, which is the 30-minute
    // window — so that is what this asserts, not the column's absence.
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
    // Every `now()` in the predicate is offset by the horizon. A bare
    // `> now()` or `>= now()` chunk is the old window returning.
    const nowChunks = predicate.match(/now\(\)[^"]*/g) ?? [];
    expect(nowChunks.length).toBeGreaterThan(0);
    for (const chunk of nowChunks) {
      expect(chunk).toContain('-');
    }
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

describe('loadLoggingDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReap.mockResolvedValue({ reapedIds: [], releasedInvites: false });
  });

  /**
   * The day load fans out four calls on one `Promise.all`, in array order:
   * meals, pending, the completion mark, then the sweep (mocked above).
   */
  function queueDay(pendingRows: unknown[]) {
    mockDbSelect
      // meals — none, so the read short-circuits before its item queries
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      // pending analyses
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(pendingRows),
          }),
        }),
      })
      // day completion mark
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
  }

  const pendingRow = (id: string) => ({
    id,
    rawInput: 'Phở bò',
    loggedAt: LOGGED_AT,
    pipelineResult: samplePipelineResult,
  });

  it('never returns a card the concurrent sweep just deleted', async () => {
    // The pending read does NOT filter on expiresAt (deliberately), so it
    // happily returns a row a week past expiry — exactly the rows the sweep
    // running beside it is deleting. Whichever query reaches the pool first
    // decides, and when the SELECT wins the day resolves with a card that no
    // longer exists: it renders, and confirm and discard both fail on it.
    queueDay([pendingRow(UUID_1), pendingRow(UUID_2)]);
    mockReap.mockResolvedValue({
      reapedIds: [UUID_1],
      releasedInvites: false,
    });

    const day = await loadLoggingDay({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(day.pendingConfirmations.map((p) => p.id)).toEqual([UUID_2]);
  });

  it('keeps every card when the sweep reaped nothing', async () => {
    // The common case by far. Filtering must not cost a live card.
    queueDay([pendingRow(UUID_1), pendingRow(UUID_2)]);

    const day = await loadLoggingDay({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(day.pendingConfirmations.map((p) => p.id)).toEqual([UUID_1, UUID_2]);
  });

  it('keeps live cards when the sweep reaped rows from OTHER days', async () => {
    // The sweep is scoped to the user, not to the requested date, so most of
    // what it reaps was never in this day's rows. An id-based subtraction is
    // right; anything count-based would strip live cards.
    queueDay([pendingRow(UUID_1)]);
    mockReap.mockResolvedValue({
      reapedIds: [UUID_MEAL],
      releasedInvites: false,
    });

    const day = await loadLoggingDay({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(day.pendingConfirmations.map((p) => p.id)).toEqual([UUID_1]);
  });

  it("passes the sweep's release signal to the caller", async () => {
    // Both clients invalidate their invite caches on this. Drop it and the
    // handed-back offer stays invisible: the inbox query is watched
    // continuously by the nav badge, so it never refetches on its own.
    queueDay([]);
    mockReap.mockResolvedValue({ reapedIds: [], releasedInvites: true });

    const day = await loadLoggingDay({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(day.releasedInvites).toBe(true);
  });

  it('reports no release when the sweep handed nothing back', async () => {
    queueDay([]);

    const day = await loadLoggingDay({
      date: '2026-04-06',
      timezoneOffset: -420,
    });

    expect(day.releasedInvites).toBe(false);
  });
});
