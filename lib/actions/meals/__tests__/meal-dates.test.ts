import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the date index reads run on the `db` singleton only.
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
  db: { select: mockDbSelect },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./meal-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { loadMealDates } from '@/lib/actions/meals/meal-dates';

describe('loadMealDates', () => {
  // mockReset, not clearAllMocks: the latter leaves queued `once` values in
  // place, so an unconsumed one would surface inside the NEXT describe.
  beforeEach(() => {
    mockDbSelect.mockReset();
  });

  /** Queues the two grouped reads: confirmed meals, then pending analyses. */
  function mockDateQueries(
    mealRows: Array<{ date: string; kcal: unknown }>,
    pendingRows: Array<{ date: string }>
  ) {
    const grouped = (rows: unknown) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
    });

    mockDbSelect
      .mockReturnValueOnce(grouped(mealRows))
      .mockReturnValueOnce(grouped(pendingRows));
  }

  it('returns merged confirmed and pending dates, newest first', async () => {
    mockDateQueries(
      [
        { date: '2026-04-06', kcal: 1842 },
        { date: '2026-04-05', kcal: 2014 },
      ],
      [{ date: '2026-04-07' }, { date: '2026-04-06' }]
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
      { date: '2026-04-06', kcal: 1842 },
      { date: '2026-04-05', kcal: 2014 },
    ]);
  });

  it('coerces the numeric SUM, which the driver hands back as a string', async () => {
    // SUM(numeric) comes off node-postgres as text to avoid float precision
    // loss. Left alone it reaches the sidebar as "1842.50" and renders raw.
    mockDateQueries([{ date: '2026-04-06', kcal: '1842.50' }], []);

    const [day] = await loadMealDates({ timezoneOffset: 0 });
    expect(day.kcal).toBe(1842.5);
    expect(typeof day.kcal).toBe('number');
  });

  it('reports a day with no calorie data as null, never 0', async () => {
    // A day whose meals all carry NULL calories sums to NULL. Zero would read
    // as "you ate nothing", which is a different claim from "we don't know".
    mockDateQueries([{ date: '2026-04-06', kcal: null }], []);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-06', kcal: null },
    ]);
  });

  it('keeps a pending-only day in the list so the sidebar still shows it', async () => {
    // pending_analyses holds nutrition inside its JSONB pipeline_result, not in
    // a column, so a staged card contributes its DATE but no calories.
    mockDateQueries([], [{ date: '2026-04-07' }]);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
    ]);
  });
});
