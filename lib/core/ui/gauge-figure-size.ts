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
 * `calorie` is sized for "2,219", `macro` for "196g" — the widest either line
 * realistically holds. The em widths below were MEASURED in the browser at the
 * real weight and tracking, not estimated: an estimate that runs 3% narrow
 * quietly spends the clearance the fill target was reserving.
 */
export const FIGURE_EM = { calorie: 2.665, macro: 2.369 } as const;

/**
 * Solving "largest figure filling 74% of the chord inside the band, bounded at
 * the edge of its own cap-height box" across r = 20…104 is near-linear, so the
 * rule is one ratio per figure rather than a stepped table — a table
 * under-fills at the top of every band. Re-solved against the measured
 * `FIGURE_EM` above; the first pass used estimates 3% narrow and spent the
 * clearance it meant to keep.
 */
export const FIGURE_RATIO = { calorie: 0.39, macro: 0.44 } as const;

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

/**
 * How wide the mouth is at the TIP line, where the unit sits.
 *
 * The sweep has ENDED there — 210° to −30° — so what bounds a line is the
 * opening between the two tip caps' inner edges, not the band's inner circle.
 * That is the only reason the long wording fits at all.
 */
export const tipOpening = (radius: number) => 1.482 * radius;

/**
 * "kcal remaining", measured in the browser at the real weight and tracking.
 *
 * Measured at 11px — the SMALLEST size {@link gaugeUnitSize} can return — and
 * not at some middle of the range, because the em width is not constant: the
 * same string runs 6.876em at 11px and 6.521em at 16px, since hinting and
 * subpixel rounding cost proportionally more the smaller the text. A figure
 * taken at 15px (6.608) is 4% narrow at 11px, which is exactly the end where
 * this test is close enough for 4% to change its answer. The worst case is the
 * only safe one to hold.
 *
 * English is the widest of the two locales: "kcal còn lại" measures 58.3px at
 * 11px against this string's 75.6px.
 */
export const LONG_UNIT_EM = 6.876;

/**
 * Whether the dial has room for the long wording ("kcal remaining") rather than
 * the one-word form ("left").
 *
 * A FIT test, not a radius threshold. A threshold made the copy depend on how
 * wide the column happened to be, so collapsing the app's sidebar changed what
 * the dial said at an unchanged viewport — the same rule, two answers, reading
 * as a glitch. Asking whether the string physically fits gives one answer per
 * size and drops to the short form only where it genuinely cannot fit (a
 * phone-width card, where the strip has wrapped anyway).
 */
export function gaugeFitsLongUnit(radius: number): boolean {
  return LONG_UNIT_EM * gaugeUnitSize(radius) <= 0.9 * tipOpening(radius);
}

/** The quiet detail under the arc, and a macro dial's label above it. */
export function gaugeMetaSize(radius: number): number {
  return clamp(Math.round(0.25 * radius), 10, 14);
}

/** Every readout line is set at 1.15, so the stack measures before it paints. */
export function gaugeLineHeight(fontSize: number): number {
  return Math.round(fontSize * 1.15);
}
