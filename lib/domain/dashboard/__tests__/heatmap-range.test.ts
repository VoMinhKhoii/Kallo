import { describe, expect, it } from 'vitest';
import { dayKeyToUtcDate } from '@/lib/core/date/day-key';
import {
  chooseRenderedHeatmapRange,
  heatmapRangeDays,
  heatmapWeekCount,
} from '@/lib/domain/dashboard/heatmap-range';

// A Wednesday.
const TODAY = '2026-10-28';

function choose(availableWidth: number, availableHeight?: number) {
  return chooseRenderedHeatmapRange({
    preferredRange: 'year',
    availableWidth,
    availableHeight,
    todayDate: TODAY,
  });
}

describe('chooseRenderedHeatmapRange', () => {
  it('keeps the full year when the viewport can fit it', () => {
    expect(choose(900)).toBe('year');
  });

  it('keeps the full year when width fits even if height is compact', () => {
    expect(choose(900, 180)).toBe('year');
  });

  it('stays at 90 days on a phone, where 14 weeks already fill the card', () => {
    // A 390px phone's card content box.
    expect(choose(324)).toBe('90d');
  });

  it('fits more recent weeks, not bigger squares, between phone and year', () => {
    // The 560px-wide window the owner reported: 14 columns stopped at 24px
    // and left ~110px of the card empty.
    const range = choose(494);
    expect(range).toBe('143d');
    expect(heatmapWeekCount(range)).toBe(21);
  });

  it('waits for 14px squares before switching to the year', () => {
    // 680px of card would draw the year at ~11px; recent days stay at ~20px.
    expect(heatmapWeekCount(choose(680))).toBe(30);
    expect(choose(830)).toBe('year');
  });

  it('starts a fitted span on a Monday, so its first column is full', () => {
    for (const width of [400, 494, 590]) {
      const days = heatmapRangeDays(choose(width)) ?? 0;
      const start = dayKeyToUtcDate(TODAY);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      expect(start.getUTCDay()).toBe(1);
    }
  });

  it('falls back to 30 days when even 90 would be too dense', () => {
    expect(choose(200)).toBe('30d');
  });

  it('keeps explicit 30 day preference even on wide screens', () => {
    expect(
      chooseRenderedHeatmapRange({
        preferredRange: '30d',
        availableWidth: 900,
        todayDate: TODAY,
      })
    ).toBe('30d');
  });
});

describe('heatmapRangeDays', () => {
  it('reads the day count, and has none for the calendar year', () => {
    expect(heatmapRangeDays('90d')).toBe(90);
    expect(heatmapRangeDays('143d')).toBe(143);
    expect(heatmapRangeDays('year')).toBeNull();
  });
});
