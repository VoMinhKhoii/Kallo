import { describe, expect, it } from 'vitest';
import { buildMealDateIndex } from '@/lib/domain/logging/meal-date-index';

describe('buildMealDateIndex', () => {
  const summaries = [
    { date: '2026-04-07', kcal: null },
    { date: '2026-04-06', kcal: 1842 },
    { date: '2026-04-05', kcal: 0 },
  ];

  it('keeps the order the action returned', () => {
    // The action sorts newest-first and the mobile strip renders straight from
    // this array. Re-sorting here would put the ordering in two places.
    expect(buildMealDateIndex(summaries).dates).toEqual([
      '2026-04-07',
      '2026-04-06',
      '2026-04-05',
    ]);
  });

  it('counts the days that hold anything', () => {
    expect(buildMealDateIndex(summaries).size).toBe(3);
    expect(buildMealDateIndex([]).size).toBe(0);
  });

  it('separates "this day holds something" from "we know its total"', () => {
    // The whole point of the type. A day whose only content is a staged card
    // has a row and a null total: it must still be marked in the calendar and
    // still render its row, while showing no number. The Map it replaces
    // answered both questions through `.get(date) ?? null`, which cannot tell
    // an absent day from a present one with an unknown total.
    const index = buildMealDateIndex(summaries);

    expect(index.has('2026-04-07')).toBe(true);
    expect(index.kcal('2026-04-07')).toBeNull();

    expect(index.has('2026-04-01')).toBe(false);
    expect(index.kcal('2026-04-01')).toBeNull();
  });

  it('reports a known total as itself', () => {
    expect(buildMealDateIndex(summaries).kcal('2026-04-06')).toBe(1842);
  });

  it('keeps a real zero rather than reading it as unknown', () => {
    // 0 is falsy, so any `||` on the way through would turn a genuine "you
    // logged nothing countable today" into "we don't know" — a different
    // claim, and one the sidebar renders differently.
    const index = buildMealDateIndex(summaries);

    expect(index.kcal('2026-04-05')).toBe(0);
    expect(index.has('2026-04-05')).toBe(true);
  });

  it('survives a duplicate date without losing the day', () => {
    // The action groups by date so this should not arise, but an index that
    // silently dropped or doubled a day would be a quiet way to lose one.
    const index = buildMealDateIndex([
      { date: '2026-04-06', kcal: 500 },
      { date: '2026-04-06', kcal: 900 },
    ]);

    expect(index.size).toBe(1);
    expect(index.dates).toEqual(['2026-04-06']);
    // Last wins, matching Map construction — stated so the behaviour is
    // chosen rather than incidental.
    expect(index.kcal('2026-04-06')).toBe(900);
  });
});
