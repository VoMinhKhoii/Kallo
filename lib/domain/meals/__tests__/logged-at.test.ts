import { beforeEach, describe, expect, it, vi } from 'vitest';

// The day's latest saved-or-staged meal comes back from one GREATEST query
// (checked against Postgres separately); here each call returns the next
// queued value. The select builders only feed that query.
const latests: (string | null)[] = [];
const execute = vi.fn(async () => [{ latest: latests.shift() ?? null }]);
const select = vi.fn(() => {
  const chain = { from: () => chain, where: () => chain };
  return chain;
});
vi.mock('@/lib/infra/db/client', () => ({ db: { select, execute } }));

const { isOnPastLocalDay, isPastLocalDay, placeAfterLatest, stampLoggedAt } =
  await import('@/lib/domain/meals/logged-at');

// UTC+7 (Vietnam): timezoneOffset is getTimezoneOffset(), so -420.
const VN = -420;
// 12:11 local on Nov 27.
const NOW = new Date('2026-11-27T05:11:00.000Z');

describe('stampLoggedAt', () => {
  beforeEach(() => {
    latests.length = 0;
    execute.mockClear();
  });

  it('stamps today at now without reading the day', async () => {
    const { loggedAt, backfilled } = await stampLoggedAt(
      'u1',
      '2026-11-27',
      VN,
      NOW
    );

    expect(loggedAt.toISOString()).toBe(NOW.toISOString());
    expect(backfilled).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it('puts a meal logged for yesterday after its later meals', async () => {
    // Yesterday's meals at 12:11 and 13:53 local; logged today at 12:11.
    latests.push('2026-11-26 06:53:00+00');

    const { loggedAt, backfilled } = await stampLoggedAt(
      'u1',
      '2026-11-26',
      VN,
      NOW
    );

    // 13:54 local: below the 13:53 meal, not above it at 12:11.
    expect(loggedAt.toISOString()).toBe('2026-11-26T06:54:00.000Z');
    // Under 18h before a share made now, so the feed needs the flag.
    expect(backfilled).toBe(true);
  });

  it("keeps today's clock time when the day's meals are all earlier", async () => {
    latests.push('2026-11-26 01:00:00+00');

    const { loggedAt } = await stampLoggedAt('u1', '2026-11-26', VN, NOW);

    expect(loggedAt.toISOString()).toBe('2026-11-26T05:11:00.000Z');
  });

  it('keeps an empty past day at the clock time', async () => {
    const { loggedAt, backfilled } = await stampLoggedAt(
      'u1',
      '2026-11-26',
      VN,
      NOW
    );

    expect(loggedAt.toISOString()).toBe('2026-11-26T05:11:00.000Z');
    expect(backfilled).toBe(true);
  });
});

describe('isPastLocalDay', () => {
  it('is false for today and a future day, true for yesterday', () => {
    expect(isPastLocalDay('2026-11-27', VN, NOW)).toBe(false);
    expect(isPastLocalDay('2026-11-28', VN, NOW)).toBe(false);
    expect(isPastLocalDay('2026-11-26', VN, NOW)).toBe(true);
  });

  it("reads the day in the user's timezone, not UTC's", () => {
    // 00:30 on Nov 27 in UTC+7 is still Nov 26 in UTC: Nov 26 is past for
    // this user.
    const earlyMorning = new Date('2026-11-26T17:30:00.000Z');

    expect(isPastLocalDay('2026-11-26', VN, earlyMorning)).toBe(true);
    expect(isPastLocalDay('2026-11-27', VN, earlyMorning)).toBe(false);
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

describe('isOnPastLocalDay', () => {
  it('reads the day of the instant in the given offset', () => {
    // 23:30 Nov 26 and 00:30 Nov 27 in UTC+7, seen at 12:11 Nov 27.
    expect(
      isOnPastLocalDay(new Date('2026-11-26T16:30:00.000Z'), VN, NOW)
    ).toBe(true);
    expect(
      isOnPastLocalDay(new Date('2026-11-26T17:30:00.000Z'), VN, NOW)
    ).toBe(false);
  });
});
