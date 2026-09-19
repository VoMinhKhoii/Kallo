import { describe, expect, it } from 'vitest';
import {
  buildXTicks,
  makeDayLabeller,
  niceYAxis,
  toDayOffsets,
  yAxisGutter,
} from '../weight-chart-utils';

describe('toDayOffsets', () => {
  it('places each reading on its calendar day, so a gap in logging stays a gap', () => {
    // Three logs spread across three weeks. Plotted by array index these would
    // be equidistant, which is the bug this replaces.
    const offsets = toDayOffsets(['2026-08-28', '2026-09-08', '2026-09-19'], 3);
    expect(offsets).toEqual([0, 11, 22]);
  });

  it('keeps unequal gaps unequal', () => {
    const offsets = toDayOffsets(['2026-08-28', '2026-08-30', '2026-09-19'], 3);
    expect(offsets[1] - offsets[0]).toBe(2);
    expect(offsets[2] - offsets[1]).toBe(20);
  });

  it('crosses a month boundary without drifting', () => {
    expect(toDayOffsets(['2026-08-31', '2026-09-01'], 2)).toEqual([0, 1]);
  });

  it('survives a DST transition — offsets are whole days, not 24h blocks', () => {
    // Northern-hemisphere clocks change inside this window; a ms/86_400_000
    // division on UTC-parsed dates would land on 30.958… and round wrong.
    const offsets = toDayOffsets(['2026-10-20', '2026-11-20'], 2);
    expect(offsets).toEqual([0, 31]);
  });

  it('falls back to array indices when the server omitted the dates', () => {
    // An older server sends `weights` without `weightDates`; render the old
    // way rather than dropping the chart.
    expect(toDayOffsets([], 3)).toEqual([0, 1, 2]);
    expect(toDayOffsets(['2026-08-28'], 3)).toEqual([0, 1, 2]);
  });

  it('returns nothing for no readings', () => {
    expect(toDayOffsets([], 0)).toEqual([]);
  });
});

describe('buildXTicks', () => {
  it('pins the last tick to the newest reading so it carries the "now" label', () => {
    const ticks = buildXTicks([0, 11, 22]);
    expect(ticks[ticks.length - 1]).toBe(22);
  });

  it('spaces ticks across the logged span, not across the reading count', () => {
    expect(buildXTicks([0, 2, 5, 8, 11, 13, 17, 20, 22])).toEqual([
      0, 7, 15, 22,
    ]);
  });

  it('deduplicates rather than emitting a repeated tick', () => {
    const ticks = buildXTicks([0, 1, 2]);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('collapses to a single tick for one reading', () => {
    expect(buildXTicks([0])).toEqual([0]);
  });

  it('collapses to a single tick when every reading is the same day', () => {
    expect(buildXTicks([0, 0, 0])).toEqual([0]);
  });
});

describe('makeDayLabeller', () => {
  it('labels by the real date, so a label never depends on tick ordinal', () => {
    const label = makeDayLabeller(['2026-08-28'], 'en-GB', '30d');
    // Day 22 after 28 Aug is 19 Sep — not "W4".
    expect(label(22)).toBe('19/9');
    expect(label(0)).toBe('28/8');
  });

  it('keeps day/month order across locales, so the two clients agree', () => {
    for (const locale of ['vi-VN', 'en-US', 'en-GB']) {
      expect(makeDayLabeller(['2026-08-28'], locale, '30d')(0)).toBe('28/8');
    }
  });

  it('rolls over month and year ends', () => {
    const label = makeDayLabeller(['2026-12-30'], 'en-GB', '30d');
    expect(label(3)).toBe('2/1');
  });

  it('switches to months on the 90-day range', () => {
    const label = makeDayLabeller(['2026-08-28'], 'en-GB', '90d');
    expect(label(0)).toBe('28 Aug');
  });

  it('is inert when the server sent no dates', () => {
    expect(makeDayLabeller([], 'en-GB', '30d')(5)).toBe('');
  });
});

describe('niceYAxis', () => {
  it('leaves headroom on both sides — the newest dot draws a halo', () => {
    const band = niceYAxis([70.4, 72.4]);
    expect(band.min).toBeLessThan(70.4);
    expect(band.max).toBeGreaterThan(72.4);
  });

  it('snaps the bounds onto whole steps', () => {
    const band = niceYAxis([70.4, 72.4]);
    expect(band.min % band.step).toBeCloseTo(0);
    expect(band.max % band.step).toBeCloseTo(0);
  });

  it('spans at least three steps, so the grid never collapses to one line', () => {
    const band = niceYAxis([71.0, 71.1]);
    expect((band.max - band.min) / band.step).toBeGreaterThanOrEqual(3);
  });

  it('emits a tick at every step', () => {
    const band = niceYAxis([69.8, 72.4]);
    expect(band.ticks[0]).toBe(band.min);
    expect(band.ticks[band.ticks.length - 1]).toBe(band.max);
    for (let i = 1; i < band.ticks.length; i++) {
      expect(band.ticks[i] - band.ticks[i - 1]).toBeCloseTo(band.step);
    }
  });

  it('bands a single reading without dividing by a zero span', () => {
    const band = niceYAxis([70.4]);
    expect(band.max).toBeGreaterThan(band.min);
    expect(Number.isFinite(band.step)).toBe(true);
  });
});

describe('yAxisGutter', () => {
  it('widens the gutter for half-kilo ticks, which print four characters', () => {
    const half = yAxisGutter(niceYAxis([70.4, 71.2]));
    expect(half.format(71)).toBe('71.0');
    expect(half.width).toBe(36);
  });

  it('keeps the narrow gutter for whole-step ticks', () => {
    const whole = yAxisGutter(niceYAxis([69.8, 74.2]));
    expect(whole.format(71)).toBe('71');
    expect(whole.width).toBe(26);
  });

  it('never clips: the gutter holds its widest tick at 12px', () => {
    // ~7px per digit at the 12px tick font, plus the 6px the axis leaves
    // before the plot. Asserting a pixel budget rather than restating the
    // helper's own branch, which would pass for any pair of numbers.
    for (const values of [[70.4], [70.4, 72.4], [69.8, 72.4], [60, 95]]) {
      const band = niceYAxis(values);
      const { format, width } = yAxisGutter(band);
      const longest = Math.max(...band.ticks.map((t) => format(t).length));
      expect(width).toBeGreaterThanOrEqual(longest * 7 + 6);
    }
  });
});

describe('hostile input', () => {
  it('falls back to positions rather than poisoning the axis with NaN', () => {
    // One unparseable date used to yield [0, NaN, 22], which makes the domain,
    // the forecast coordinates and every tick invalid.
    const offsets = toDayOffsets(['2026-08-28', 'not-a-date', '2026-09-19'], 3);
    expect(offsets).toEqual([0, 1, 2]);
    expect(offsets.every(Number.isFinite)).toBe(true);
  });

  it('falls back to positions when the series runs backwards', () => {
    // Out-of-order dates gave negative offsets, which put the newest reading
    // outside the plot and labelled an older one "now".
    expect(toDayOffsets(['2026-09-01', '2026-09-20', '2026-09-10'], 3)).toEqual(
      [0, 1, 2]
    );
  });

  it('accepts two readings on the same day', () => {
    expect(toDayOffsets(['2026-08-28', '2026-08-28'], 2)).toEqual([0, 0]);
  });

  it('labels nothing rather than throwing on an unparseable first date', () => {
    // Intl.DateTimeFormat throws RangeError on an Invalid Date.
    expect(() => makeDayLabeller(['nope'], 'en', '30d')(3)).not.toThrow();
    expect(makeDayLabeller(['nope'], 'en', '30d')(3)).toBe('');
  });

  it('bands non-finite input instead of hanging the tick loop', () => {
    // `for (v = min; v <= max; v += step)` never advances past Infinity, so an
    // infinite bound froze the main thread rather than drawing a bad chart.
    for (const values of [
      [Number.POSITIVE_INFINITY],
      [Number.NaN],
      [70, Number.NaN],
    ]) {
      const band = niceYAxis(values);
      expect(Number.isFinite(band.min)).toBe(true);
      expect(Number.isFinite(band.max)).toBe(true);
      expect(band.ticks.length).toBeLessThan(50);
      expect(band.ticks.every(Number.isFinite)).toBe(true);
    }
  });

  it('puts day before month in every locale, matching mobile', () => {
    // `Intl` renders `en` as "8/28" against mobile's "28/8" for the same day.
    expect(makeDayLabeller(['2026-08-28'], 'en', '30d')(0)).toBe('28/8');
    expect(makeDayLabeller(['2026-08-28'], 'vi', '30d')(0)).toBe('28/8');
  });
});
