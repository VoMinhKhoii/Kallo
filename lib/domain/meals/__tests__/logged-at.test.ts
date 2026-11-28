import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each select chain resolves to the next queued result: meals first, then
// pending_analyses (the order `stampLoggedAt` reads them in).
const results: { loggedAt: Date }[][] = [];
const select = vi.fn(() => {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => results.shift() ?? [],
  };
  return chain;
});
vi.mock('@/lib/infra/db/client', () => ({ db: { select } }));

const { placeAfterLatest, stampLoggedAt } = await import(
  '@/lib/domain/meals/logged-at'
);

// UTC+7 (Vietnam): timezoneOffset is getTimezoneOffset(), so -420.
const VN = -420;
// 12:11 local on Nov 27.
const NOW = new Date('2026-11-27T05:11:00.000Z');

describe('stampLoggedAt', () => {
  beforeEach(() => {
    results.length = 0;
    select.mockClear();
  });

  it('stamps today at now without reading the day', async () => {
    const at = await stampLoggedAt('u1', '2026-11-27', VN, NOW);

    expect(at.toISOString()).toBe(NOW.toISOString());
    expect(select).not.toHaveBeenCalled();
  });

  it('puts a meal logged for yesterday after its later meals', async () => {
    // Yesterday's meals at 12:11 and 13:53 local; logged today at 12:11.
    results.push([{ loggedAt: new Date('2026-11-26T06:53:00.000Z') }], []);

    const at = await stampLoggedAt('u1', '2026-11-26', VN, NOW);

    // 13:54 local: below the 13:53 meal, not above it at 12:11.
    expect(at.toISOString()).toBe('2026-11-26T06:54:00.000Z');
  });

  it('counts a staged (unconfirmed) meal on that day too', async () => {
    results.push(
      [{ loggedAt: new Date('2026-11-26T06:53:00.000Z') }],
      [{ loggedAt: new Date('2026-11-26T10:00:00.000Z') }]
    );

    const at = await stampLoggedAt('u1', '2026-11-26', VN, NOW);

    expect(at.toISOString()).toBe('2026-11-26T10:01:00.000Z');
  });

  it("keeps today's clock time when the day's meals are all earlier", async () => {
    results.push([{ loggedAt: new Date('2026-11-26T01:00:00.000Z') }], []);

    const at = await stampLoggedAt('u1', '2026-11-26', VN, NOW);

    expect(at.toISOString()).toBe('2026-11-26T05:11:00.000Z');
  });

  it('keeps an empty past day at the clock time', async () => {
    const at = await stampLoggedAt('u1', '2026-11-26', VN, NOW);

    expect(at.toISOString()).toBe('2026-11-26T05:11:00.000Z');
  });
});

describe('placeAfterLatest', () => {
  const clock = new Date('2026-11-26T05:11:00.000Z');
  // End of Nov 26 local (UTC+7).
  const dayEnd = new Date('2026-11-26T17:00:00.000Z');

  it('stays inside the day when the latest meal is at 23:59:30', () => {
    const latest = new Date('2026-11-26T16:59:30.000Z');

    const at = placeAfterLatest(clock, latest, dayEnd);

    expect(at.getTime()).toBe(dayEnd.getTime() - 1);
    expect(at.getTime()).toBeGreaterThan(latest.getTime());
  });

  it('moves past a meal at exactly the clock time', () => {
    const at = placeAfterLatest(clock, clock, dayEnd);

    expect(at.toISOString()).toBe('2026-11-26T05:12:00.000Z');
  });
});
