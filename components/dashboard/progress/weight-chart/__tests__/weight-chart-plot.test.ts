import { describe, expect, it } from 'vitest';
import { buildWeightPlot } from '../weight-chart-utils';

const DATES = ['2026-08-28', '2026-09-08', '2026-09-19'];
const WEIGHTS = [72.4, 71.5, 70.4];

function plot(over: Partial<Parameters<typeof buildWeightPlot>[0]> = {}) {
  return buildWeightPlot({
    weights: WEIGHTS,
    dates: DATES,
    rangeDays: 30,
    canProject: false,
    placeholder: 70,
    ...over,
  });
}

describe('buildWeightPlot — readings', () => {
  it('places each reading on its calendar day', () => {
    expect(plot().points.map((p) => p.day)).toEqual([0, 11, 22]);
  });

  it('keeps an uneven gap uneven', () => {
    const p = plot({ dates: ['2026-08-28', '2026-08-30', '2026-09-19'] });
    const days = p.points.map((x) => x.day);
    expect(days[1] - days[0]).toBe(2);
    expect(days[2] - days[1]).toBe(20);
  });
});

describe('buildWeightPlot — forecast', () => {
  it('appends a projection point past the newest reading', () => {
    const p = plot({
      canProject: true,
      projectedEndWeight: 69.8,
      periodElapsedDays: 22,
    });

    expect(p.showForecast).toBe(true);
    expect(p.points).toHaveLength(WEIGHTS.length + 1);
    const tail = p.points[p.points.length - 1];
    expect(tail.actual).toBeNull();
    expect(tail.forecast).toBe(69.8);
    expect(tail.day).toBeGreaterThan(p.lastOffset);
  });

  it('leaves the logged readings at least 80% of the width', () => {
    const p = plot({
      canProject: true,
      projectedEndWeight: 69.8,
      periodElapsedDays: 22,
    });
    expect(p.lastOffset / p.xDomain[1]).toBeGreaterThanOrEqual(0.8);
  });

  it('draws no tail without a projection', () => {
    expect(plot().showForecast).toBe(false);
    expect(plot().points).toHaveLength(WEIGHTS.length);
  });

  it('ignores canProject when no projected weight came with it', () => {
    expect(plot({ canProject: true }).showForecast).toBe(false);
  });
});

describe('buildWeightPlot — ticks', () => {
  it('labels the newest reading "now" and the rest by date', () => {
    const ticks = plot().ticks;
    expect(ticks[ticks.length - 1]).toEqual({ value: 22, kind: 'now' });
    expect(ticks[0]).toEqual({ value: 0, kind: 'date' });
  });

  it('gives a single reading one tick, named by its own date', () => {
    // Not "Start": with one reading there is no span to be at the start of,
    // and a second "Now" tick would name a day nothing was logged on.
    const p = plot({ weights: [70.4], dates: ['2026-09-19'] });
    expect(p.ticks).toEqual([{ value: 0, kind: 'date' }]);
  });

  it('falls back to "now" for a single reading with no date', () => {
    const p = plot({ weights: [70.4], dates: [] });
    expect(p.ticks).toEqual([{ value: 0, kind: 'now' }]);
  });

  it('degrades to the two ends when the server sent no dates', () => {
    // Positional x, so the only honest labels are the ends — never a row of
    // blank ticks.
    const p = plot({ dates: [] });
    expect(p.ticks).toEqual([
      { value: 0, kind: 'start' },
      { value: 2, kind: 'now' },
    ]);
  });

  it('never emits a tick with no label kind', () => {
    for (const dates of [DATES, [], ['2026-08-28']]) {
      for (const tick of plot({ dates }).ticks) {
        expect(['start', 'now', 'date']).toContain(tick.kind);
      }
    }
  });
});

describe('buildWeightPlot — nothing logged', () => {
  const empty = () => plot({ weights: [], dates: [] });

  it('still yields a frame: a full-range domain and both end ticks', () => {
    expect(empty().isEmpty).toBe(true);
    expect(empty().points).toEqual([]);
    expect(empty().xDomain).toEqual([0, 29]);
    expect(empty().ticks).toEqual([
      { value: 0, kind: 'start' },
      { value: 29, kind: 'now' },
    ]);
  });

  it('bands around the weight we do know, so the scale is plausible', () => {
    const { band } = empty();
    expect(band.min).toBeLessThan(70);
    expect(band.max).toBeGreaterThan(70);
  });

  it('never projects', () => {
    expect(
      plot({ weights: [], dates: [], canProject: true, projectedEndWeight: 69 })
        .showForecast
    ).toBe(false);
  });
});
