import { describe, expect, it } from 'vitest';
import {
  FIGURE_MIN_PX,
  gaugeFigureSize,
  gaugeFitsLongUnit,
  gaugeMetaSize,
  gaugeUnitSize,
} from '@/lib/core/ui/gauge-figure-size';
import {
  CALORIE_RATIO,
  DOCK_MACRO_CAP,
  FEED_MACRO_CAP,
  gaugeStackedSizes,
  gaugeStripSizes,
  MACRO_MIN_RADIUS,
} from '@/lib/core/ui/gauge-strip-layout';

/**
 * The widths the two surfaces really hand the strip, measured off the shell:
 * a 1368px Today card on a 16-inch MacBook gives its gauge column 44% of the
 * content box; the logging header is the composer's own `max-w-3xl`.
 */
const DOCK_16 = 588;
const DOCK_13 = 474;
const COMPOSER = 768;

describe('gaugeStripSizes', () => {
  it('fills the room it is given rather than centring inside it', () => {
    const { width } = gaugeStripSizes(DOCK_16, DOCK_MACRO_CAP);

    // The bug this replaced: three fixed-size dials centred in a `flex-1` box,
    // which left ~290px of nothing beside the calorie dial and grew with the
    // viewport. Under the cap the cluster must very nearly fill its column.
    expect(width).toBeLessThanOrEqual(DOCK_16);
    expect(width).toBeGreaterThan(DOCK_16 * 0.95);
  });

  it('never overflows the column that sized it', () => {
    // Every width from a phone card to an ultrawide dock, one pixel at a time:
    // rounding the marks and the gaps independently is what would break this.
    for (let available = 350; available <= 1600; available += 1) {
      const sizes = gaugeStripSizes(available, DOCK_MACRO_CAP);
      if (sizes.wraps) continue;
      expect(sizes.width).toBeLessThanOrEqual(available);
    }
  });

  it('grows the marks with the room, and shrinks them with it', () => {
    const wide = gaugeStripSizes(DOCK_16, DOCK_MACRO_CAP);
    const narrow = gaugeStripSizes(DOCK_13, DOCK_MACRO_CAP);

    expect(wide.macroRadius).toBeGreaterThan(narrow.macroRadius);
    expect(wide.calorieRadius).toBeGreaterThan(narrow.calorieRadius);
    expect(narrow.wraps).toBe(false);
  });

  it('ties the gap to the mark, never to the leftover width', () => {
    const a = gaugeStripSizes(DOCK_16, DOCK_MACRO_CAP);
    const b = gaugeStripSizes(DOCK_16 * 4, DOCK_MACRO_CAP);

    // Four times the room, and the cap binds — so the gap must hold, and the
    // caller centres the cluster instead of the gap swallowing the difference.
    expect(b.macroRadius).toBe(DOCK_MACRO_CAP);
    expect(b.gap).toBe(Math.round(DOCK_MACRO_CAP * 2 * 0.42));
    expect(a.gap).toBeLessThan(b.gap);
    expect(b.width).toBeLessThan(DOCK_16 * 4);
  });

  it('keeps the calorie mark dominant at every size', () => {
    for (const available of [300, 474, 588, 900, 1400]) {
      const { calorieRadius, macroRadius } = gaugeStripSizes(
        available,
        DOCK_MACRO_CAP
      );
      expect(calorieRadius / macroRadius).toBeCloseTo(CALORIE_RATIO, 1);
    }
  });

  it('holds the feed header to its own, smaller cap', () => {
    const feed = gaugeStripSizes(COMPOSER, FEED_MACRO_CAP);
    const dock = gaugeStripSizes(COMPOSER, DOCK_MACRO_CAP);

    expect(feed.macroRadius).toBe(FEED_MACRO_CAP);
    expect(feed.macroRadius).toBeLessThan(dock.macroRadius);
    // Capped, so the cluster is narrower than the column and gets centred.
    expect(feed.width).toBeLessThan(COMPOSER);
  });

  it('never sizes a mark below what its own figure needs', () => {
    for (const available of [120, 240, 311, 400]) {
      const { macroRadius, calorieRadius } = gaugeStripSizes(
        available,
        DOCK_MACRO_CAP
      );
      expect(macroRadius).toBeGreaterThanOrEqual(MACRO_MIN_RADIUS);
      expect(gaugeFigureSize(macroRadius, 'macro')).toBeGreaterThanOrEqual(
        FIGURE_MIN_PX
      );
      expect(gaugeFigureSize(calorieRadius, 'calorie')).toBeGreaterThanOrEqual(
        FIGURE_MIN_PX
      );
    }
  });

  it('says when four marks no longer fit on one line', () => {
    // A phone-width card: one line would need a radius under the legibility
    // floor, so the caller stacks instead of shrinking the figure into nothing.
    expect(gaugeStripSizes(311, DOCK_MACRO_CAP).wraps).toBe(true);
    expect(gaugeStripSizes(DOCK_13, DOCK_MACRO_CAP).wraps).toBe(false);
  });
});

describe('gaugeStackedSizes', () => {
  it('fits three macros on the line it wrapped to', () => {
    const stacked = gaugeStackedSizes(311, DOCK_MACRO_CAP);

    expect(stacked.width).toBeLessThanOrEqual(311);
    expect(stacked.calorieRadius * 2).toBeLessThanOrEqual(311);
    expect(
      gaugeFigureSize(stacked.macroRadius, 'macro')
    ).toBeGreaterThanOrEqual(FIGURE_MIN_PX);
  });
});

describe('the readout sizes the strip resolves to', () => {
  it('lands the dashboard mark within a step of the shipped hero figure', () => {
    // 44px `text-hero` is what the dashboard drew before any of this; the
    // derived ratio has to agree with it at the radius that mark was drawn at.
    expect(gaugeFigureSize(104, 'calorie')).toBeGreaterThanOrEqual(41);
    expect(gaugeFigureSize(104, 'calorie')).toBeLessThanOrEqual(44);
  });

  it('caps the lines that sit on the tips, where the opening stops growing', () => {
    expect(gaugeUnitSize(300)).toBe(16);
    expect(gaugeMetaSize(300)).toBe(14);
  });
});

/**
 * The app rail collapses from 260px to 68px, which changes the dock's gauge
 * column by ~190px at an unchanged viewport. The marks are supposed to respond
 * to that; the COPY is not — a dial that says "left" with the rail open and
 * "kcal remaining" with it shut reads as a glitch, and that is what a radius
 * threshold produced before `gaugeFitsLongUnit` replaced it.
 */
describe('the dial reads the same however wide the rail is', () => {
  const EXPANDED_RAIL = 260;
  const COLLAPSED_RAIL = 68;

  /** The dock's gauge column: 44% of the Today card's content box. */
  const gaugeColumn = (viewport: number, rail: number) =>
    Math.round(0.44 * (Math.min(1440, viewport - 24 - rail - 12) - 64 - 32));

  it('picks the same wording in both rail states, at every desktop width', () => {
    for (let viewport = 1280; viewport <= 1920; viewport += 1) {
      const open = gaugeStripSizes(
        gaugeColumn(viewport, EXPANDED_RAIL),
        DOCK_MACRO_CAP
      );
      const shut = gaugeStripSizes(
        gaugeColumn(viewport, COLLAPSED_RAIL),
        DOCK_MACRO_CAP
      );

      // The marks DO respond to the extra room — that part is the point.
      expect(shut.calorieRadius).toBeGreaterThanOrEqual(open.calorieRadius);
      // The words do not.
      expect(gaugeFitsLongUnit(shut.calorieRadius)).toBe(
        gaugeFitsLongUnit(open.calorieRadius)
      );
      expect(gaugeFitsLongUnit(open.calorieRadius)).toBe(true);
    }
  });

  it('says the same thing on the feed header as in the dock', () => {
    // Same question, same sentence, whichever page you are on. The feed caps
    // its marks far smaller than the dock does — that is the whole point of a
    // fixed header — so this is the constraint `FEED_MACRO_CAP` is chosen
    // against, not a coincidence to be discovered later by looking.
    expect(
      gaugeFitsLongUnit(gaugeStripSizes(COMPOSER, FEED_MACRO_CAP).calorieRadius)
    ).toBe(true);
    expect(
      gaugeFitsLongUnit(gaugeStripSizes(COMPOSER, DOCK_MACRO_CAP).calorieRadius)
    ).toBe(true);
  });

  it('drops to the short wording only where it genuinely will not fit', () => {
    // A phone-width card has wrapped the strip and its calorie mark is down at
    // the floor; there is no room for the sentence at any font size.
    expect(gaugeFitsLongUnit(48)).toBe(false);
  });
});
