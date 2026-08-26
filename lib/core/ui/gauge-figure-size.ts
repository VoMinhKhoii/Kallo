/**
 * How large a dial's readout is drawn — derived from the arc, never fixed.
 *
 * The dials used to spell one 14px figure whatever the arc did, which read
 * hollow on a large mark and overflowed a small one. The sizes below come from
 * the geometry instead:
 *
 * - The FIGURE sits inside the band, whose inner edge is `1 - BAND_RATIO` of
 *   the outer radius (0.75r). What bounds it is the chord at the edge of its
 *   own cap-height box, not at its baseline — solving "largest figure filling
 *   ~74% of that chord" across r = 20…104 comes out almost perfectly linear,
 *   so the rule is one ratio per figure rather than a stepped table. A step
 *   table under-fills at the top of every band, which is exactly what it looked
 *   like.
 * - The UNIT sits ON the tips, where the sweep has ENDED — so what bounds it is
 *   the opening between the two tip caps' inner edges (`TIP_OPENING`), not the
 *   inner circle. That is the only reason the long wording fits at all.
 *
 * At r = 104 the calorie ratio lands on 42, within a rounding step of the 44px
 * `text-hero` the dashboard already shipped — which is the check that the
 * constant is right.
 *
 * Pure and separate from the components because this IS the rule, and because
 * asserting it through rendered style strings is how the last one went
 * untested. Web-only for now: the Flutter dials still spell fixed sizes.
 */

/**
 * Ratio of figure size to outer radius, per readout.
 *
 * `calorie` is sized for "2,219" (2.60 em in the app's tabular sans), `macro`
 * for "196g" (2.29 em) — the widest either line realistically holds.
 */
export const FIGURE_RATIO = { calorie: 0.4, macro: 0.455 } as const;

export type FigureKind = keyof typeof FIGURE_RATIO;

/**
 * The legibility floor. It is also why `MACRO_MIN_RADIUS` exists: below that
 * radius the arc cannot hold a figure at this size, so the strip wraps rather
 * than shrink the number into nothing.
 */
export const FIGURE_MIN_PX = 11;

/** The dashboard's hero figure, which no dial may exceed. */
export const FIGURE_MAX_PX = 44;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** The headline figure nested in the arc's mouth. */
export function gaugeFigureSize(radius: number, kind: FigureKind): number {
  return clamp(
    Math.round(FIGURE_RATIO[kind] * radius),
    FIGURE_MIN_PX,
    FIGURE_MAX_PX
  );
}

/** The line that lands on the tips — what the headline is, in words. */
export function gaugeUnitSize(radius: number): number {
  return clamp(Math.round(0.18 * radius), 11, 16);
}

/** The quiet detail under the arc, and a macro dial's label above it. */
export function gaugeMetaSize(radius: number): number {
  return clamp(Math.round(0.25 * radius), 10, 14);
}

/** Every readout line is set at 1.15, so the stack measures before it paints. */
export function gaugeLineHeight(fontSize: number): number {
  return Math.round(fontSize * 1.15);
}
