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

// The cap lives with the renderability decision it bounds, not with the query:
// `meal-dates.ts` is a 'use server' module, which may export async functions
// only.
import { PENDING_SCAN_LIMIT } from '@/lib/actions/meals/day/staged-card';
import { loadMealDates } from '@/lib/actions/meals/meal-dates';
import { samplePipelineResult } from './meal-doubles';

/** A staged row the feed would actually render. */
function stagedRow(date: string) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    rawInput: 'Phở bò',
    loggedAt: new Date(`${date}T08:00:00.000Z`),
    entryMode: 'precise',
    pipelineResult: samplePipelineResult,
    date,
  };
}

describe('loadMealDates', () => {
  // mockReset, not clearAllMocks: the latter leaves queued `once` values in
  // place, so an unconsumed one would surface inside the NEXT describe.
  beforeEach(() => {
    mockDbSelect.mockReset();
  });

  const limitSpy = vi.fn();

  /**
   * Queues the three reads, in the order `loadMealDates` puts them in its
   * `Promise.all`: the grouped meals scan, the grouped pending-DATE scan, and
   * the capped pending-PAYLOAD scan. Only the third pulls JSONB, so only it
   * has an `.orderBy().limit()` tail.
   *
   * `pendingDates` defaults to the dates the payload rows carry — the ordinary
   * case, where the cap was never reached and the two pending scans agree. The
   * truncation tests pass it explicitly to describe a user with staged rows
   * the payload scan never got to.
   */
  function mockDateQueries(
    mealRows: Array<{ date: string; kcal: unknown }>,
    pendingRows: Array<Record<string, unknown> & { date: string }>,
    pendingDates: string[] = pendingRows.map((row) => row.date)
  ) {
    limitSpy.mockReset().mockResolvedValue(pendingRows);
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue(mealRows),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi
              .fn()
              .mockResolvedValue(
                Array.from(new Set(pendingDates), (date) => ({ date }))
              ),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({ limit: limitSpy }),
          }),
        }),
      });
  }

  it('ignores staged cards the feed has already stopped rendering', async () => {
    // The feed hides a pending card past the 7-day reaping horizon
    // (isStillStaged, load-meals.ts). This query has to draw the SAME line: an
    // abandoned row that only still exists because a best-effort sweep has not
    // run would otherwise mask a real saved total for a card nobody can see.
    const pendingWheres: unknown[] = [];
    const capture = (returns: unknown) =>
      vi.fn().mockImplementation((predicate: unknown) => {
        pendingWheres.push(predicate);
        return returns;
      });

    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: capture({ groupBy: vi.fn().mockResolvedValue([]) }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: capture({
            orderBy: vi
              .fn()
              .mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
          }),
        }),
      });

    await loadMealDates({ timezoneOffset: 0 });

    // BOTH pending scans, not just the payload one: the date scan is what
    // decides which days the sidebar lists at all, so an abandoned row leaking
    // into it would paint a day the feed draws as empty.
    expect(pendingWheres).toHaveLength(2);
    for (const predicate of pendingWheres) {
      expect(JSON.stringify(predicate)).toContain("interval '7 days'");
    }
  });

  it('returns merged confirmed and pending dates, newest first', async () => {
    mockDateQueries(
      [
        { date: '2026-04-06', kcal: 1842 },
        { date: '2026-04-05', kcal: 2014 },
      ],
      [stagedRow('2026-04-07'), stagedRow('2026-04-06')]
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
      // Apr 6 has a saved meal AND a pending card, so its total is unknown —
      // 1842 is only the part that has been confirmed. See the overlap case
      // below; this expectation used to say 1842 and was wrong.
      { date: '2026-04-06', kcal: null },
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

  it('asks the DB for null when ANY meal on the day lacks calories', async () => {
    // Postgres SUM skips NULL rows, so a 500 kcal meal beside a legacy meal
    // with unknown calories came back as a clean 500 — an incomplete total
    // presented as a complete one, which is the fake precision the contract
    // (and the design system) say not to show. The guard has to live in the
    // aggregate: once the rows are summed, nothing downstream can tell a
    // complete total from a partial one.
    mockDateQueries([], []);

    await loadMealDates({ timezoneOffset: 0 });

    const projection = JSON.stringify(mockDbSelect.mock.calls[0]?.[0]);
    expect(projection).toContain('COUNT');
  });

  it('reports a day with no calorie data as null, never 0', async () => {
    // A day whose meals all carry NULL calories sums to NULL. Zero would read
    // as "you ate nothing", which is a different claim from "we don't know".
    mockDateQueries([{ date: '2026-04-06', kcal: null }], []);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-06', kcal: null },
    ]);
  });

  it('keeps the total when the only pending row on the day is unrenderable', async () => {
    // The feed drops a staged row whose pipelineResult is legacy or malformed
    // — it is neither visible nor confirmable. Masking a real saved total for
    // a card nobody can see hides that day's number until the row is reaped,
    // up to seven days later.
    mockDateQueries(
      [{ date: '2026-04-06', kcal: 500 }],
      [{ ...stagedRow('2026-04-06'), pipelineResult: { junk: true } }]
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-06', kcal: 500 },
    ]);
  });

  it('gives up the total on a day that also holds a pending card', async () => {
    // Same trap as the SUM guard, one layer up: a staged card's calories are
    // deliberately not counted, so a day with a saved 500 kcal meal AND a
    // pending card knows only part of what was eaten. Keeping the 500 would
    // show a subtotal wearing the face of a complete total.
    mockDateQueries(
      [{ date: '2026-04-06', kcal: 500 }],
      [stagedRow('2026-04-06')]
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-06', kcal: null },
    ]);
  });

  it('keeps a pending-only day in the list so the sidebar still shows it', async () => {
    // pending_analyses holds nutrition inside its JSONB pipeline_result, not in
    // a column, so a staged card contributes its DATE but no calories.
    mockDateQueries([], [stagedRow('2026-04-07')]);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
    ]);
  });

  // -------------------------------------------------------------------------
  // Skew between the two pending scans
  //
  // They are separate statements, so under READ COMMITTED each gets its own
  // snapshot and a row inserted between them is seen by only one. The merge
  // must not need them to agree: whichever scan saw a live staged card, that
  // card's day gets the treatment it earns.
  // -------------------------------------------------------------------------

  it('lists a pending-only day only the payload scan saw', async () => {
    // Staged between the grouped date scan and the payload scan, so the date
    // scan has no row for it. Driving the output off the date scan alone would
    // drop a day the feed renders — the sidebar-disagrees-with-the-feed class
    // this file has already fixed three times.
    mockDateQueries([], [stagedRow('2026-04-07')], []);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
    ]);
  });

  it('masks a total when only the payload scan saw the staged card', async () => {
    // Same skew, on a day that also holds a saved meal. Keeping the 500 would
    // show a subtotal wearing the face of a complete total, which is the
    // failure direction that matters.
    mockDateQueries(
      [{ date: '2026-04-06', kcal: 500 }],
      [stagedRow('2026-04-06')],
      []
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-06', kcal: null },
    ]);
  });

  // -------------------------------------------------------------------------
  // The payload scan's cardinality
  // -------------------------------------------------------------------------

  it('caps the staged-payload scan instead of reading every abandoned row', async () => {
    // Deciding renderability needs each row's pipeline_result, and nothing
    // bounds how many of those a user accumulates: barcode staging inserts
    // with a NULL attempt_id (so the (user_id, attempt_id) unique index cannot
    // dedupe it) and stageBarcodeMealAction runs no limiter, while the AI path
    // allows 100 fresh attempts a day against a 7-day horizon. Unbounded, this
    // read pulls multi-kilobyte JSONB per row on every timeline load.
    mockDateQueries([], []);

    await loadMealDates({ timezoneOffset: 0 });

    // +1 is the probe: it is how the merge learns there was more to read.
    expect(limitSpy).toHaveBeenCalledWith(PENDING_SCAN_LIMIT + 1);
  });

  it('gives up totals on the days its capped scan could not reach', async () => {
    // DATE(logged_at + offset) is monotonic in logged_at, so a scan ordered by
    // logged_at DESC reads whole days newest-first. Past the cap the unread
    // rows are all on the oldest day it touched or older — and any of them may
    // be a renderable card. Guessing "no card" there would show a subtotal
    // wearing the face of a complete total, the bug this file already fixes
    // twice, so an unreachable day reports an unknown total instead.
    const overflow = Array.from({ length: PENDING_SCAN_LIMIT + 1 }, () =>
      stagedRow('2026-04-07')
    );
    mockDateQueries(
      [
        { date: '2026-04-07', kcal: 700 },
        { date: '2026-04-05', kcal: 2014 },
        { date: '2026-04-03', kcal: 1500 },
      ],
      overflow,
      // The date scan is grouped, so it sees every day regardless of the cap.
      ['2026-04-07', '2026-04-05']
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
      // Below the boundary and never scanned, yet the grouped date scan says
      // it holds a staged row: unknown, not 2014.
      { date: '2026-04-05', kcal: null },
      // No staged row at all, so the cap never touches it.
      { date: '2026-04-03', kcal: 1500 },
    ]);
  });

  it('still judges days above the truncation boundary from their payloads', async () => {
    // Conservatism is for what the scan could not see. A day it read in full —
    // anything strictly newer than the oldest day it reached — is decided the
    // normal way, so an unrenderable-only day up there keeps its real total.
    const overflow = [
      { ...stagedRow('2026-04-07'), pipelineResult: { junk: true } },
      ...Array.from({ length: PENDING_SCAN_LIMIT }, () =>
        stagedRow('2026-04-06')
      ),
    ];
    mockDateQueries(
      [
        { date: '2026-04-07', kcal: 700 },
        { date: '2026-04-06', kcal: 900 },
      ],
      overflow,
      ['2026-04-07', '2026-04-06']
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: 700 },
      { date: '2026-04-06', kcal: null },
    ]);
  });

  it('keeps the total on the boundary day when the probe row proves it complete', async () => {
    // The probe row is the first one the scan did NOT inspect, so it — not the
    // last row the scan DID inspect — is where the blind spot starts. When the
    // probe lands on an older day, every row on the day above it was seen, and
    // that day is fully decided: masking it would give up a real total for a
    // day nothing was actually unknown about.
    const overflow = [
      ...Array.from({ length: PENDING_SCAN_LIMIT }, () => ({
        ...stagedRow('2026-04-07'),
        pipelineResult: { junk: true },
      })),
      stagedRow('2026-04-05'),
    ];
    mockDateQueries(
      [
        { date: '2026-04-07', kcal: 700 },
        { date: '2026-04-05', kcal: 500 },
      ],
      overflow,
      ['2026-04-07', '2026-04-05']
    );

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      // Every staged row on it was scanned and none was renderable.
      { date: '2026-04-07', kcal: 700 },
      // The probe's own day: at least one row on it went uninspected.
      { date: '2026-04-05', kcal: null },
    ]);
  });

  it('lists a day the capped scan never reached even with no saved meal', async () => {
    // The grouped date scan is the only thing that knows this day exists. Drop
    // it and the sidebar loses a day the feed would draw, which is the same
    // disagreement the shared renderability test was added to end.
    const overflow = Array.from({ length: PENDING_SCAN_LIMIT + 1 }, () =>
      stagedRow('2026-04-07')
    );
    mockDateQueries([], overflow, ['2026-04-07', '2026-04-01']);

    expect(await loadMealDates({ timezoneOffset: 0 })).toEqual([
      { date: '2026-04-07', kcal: null },
      { date: '2026-04-01', kcal: null },
    ]);
  });
});
