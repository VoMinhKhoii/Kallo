import { FIGURE_MIN_PX } from '@/lib/core/ui/gauge-figure-size';

/**
 * How the day's four marks — the calorie dial and the three macro dials — fill
 * the room a surface gives them.
 *
 * The rule that matters: THE GAP IS TIED TO THE MARK, never to leftover width.
 * The row this replaced sized its dials at a fixed radius and centred them in
 * whatever box it was handed, so on a wide viewport ~290px of nothing opened up
 * beside the calorie dial and grew with the window. Here the marks grow into
 * the room until a per-surface cap binds, and only then does the cluster centre.
 *
 * Flutter's `MacroDialRow` already shrinks its dials to fit a narrow phone
 * (`radius = min(maxRadius, column / 2)`); this is the same idea with the cap
 * raised, so the marks also GROW on a desktop.
 */

/** The calorie mark against a macro mark — the headline stays dominant. */
export const CALORIE_RATIO = 1.9;

/** The gap between marks, as a fraction of a macro DIAMETER. */
export const GAP_RATIO = 0.42;

/**
 * Below this the figure would fall under `FIGURE_MIN_PX`, so the caller wraps
 * to two rows instead of drawing an illegible number.
 */
export const MACRO_MIN_RADIUS = 26;

/**
 * The caps each surface sets on itself.
 *
 * `FEED_MACRO_CAP` is picked so the calorie dial can SAY THE SAME SENTENCE the
 * dock's does. Every pixel here is feed the reader loses, so it was 28 — but at
 * the radius that gives (53) "kcal remaining" measures 96% of the mouth, so the
 * header dropped to "left" and the same dial answered "how am I doing today?"
 * two different ways on two pages. 32 puts the string at 85% of the mouth,
 * which clears `gaugeFitsLongUnit`'s margin honestly, for 10px of header.
 *
 * `DOCK_MACRO_CAP` is picked from the NARROW case, not the wide one. At xl the
 * dock's gauge column is 44% of the card and the cap barely binds; below xl the
 * card stacks and the strip gets the whole width, which without a cap would draw
 * BIGGER marks on a tablet than on a 16-inch desktop. Capping at the xl size
 * keeps one look across the breakpoint.
 */
export const FEED_MACRO_CAP = 32;
export const DOCK_MACRO_CAP = 48;

/**
 * Four marks and three gaps, expressed in macro radii:
 * `2·CALORIE_RATIO + 6 + 6·GAP_RATIO`.
 */
const WIDTH_IN_MACRO_RADII = 2 * CALORIE_RATIO + 6 + 6 * GAP_RATIO;

export interface GaugeStripSizes {
  calorieRadius: number;
  macroRadius: number;
  gap: number;
  /** What the cluster actually measures, so a caller can centre it. */
  width: number;
  /** The room was too tight even at `MACRO_MIN_RADIUS` — stack instead. */
  wraps: boolean;
}

/**
 * @param available the content width the strip may use, in CSS px
 * @param macroCap the surface's own ceiling on a macro dial's radius
 */
export function gaugeStripSizes(
  available: number,
  macroCap: number
): GaugeStripSizes {
  const natural = available / WIDTH_IN_MACRO_RADII;
  // FLOOR, not round, all three: rounding each of the four marks and three gaps
  // independently can push the cluster a couple of pixels past the column that
  // sized it, and a strip that overflows its own container is the one failure
  // this whole rule exists to prevent. Flooring keeps
  // `width <= WIDTH_IN_MACRO_RADII * natural = available` by construction.
  const macroRadius = Math.floor(
    Math.min(Math.max(natural, MACRO_MIN_RADIUS), macroCap)
  );
  const calorieRadius = Math.floor(macroRadius * CALORIE_RATIO);
  const gap = Math.floor(macroRadius * 2 * GAP_RATIO);

  return {
    calorieRadius,
    macroRadius,
    gap,
    width: 2 * calorieRadius + 6 * macroRadius + 3 * gap,
    wraps: natural < MACRO_MIN_RADIUS,
  };
}

/**
 * The wrapped form: the calorie mark on its own line, the three macros sharing
 * the one below. Only reached when `gaugeStripSizes().wraps` — a phone-width
 * card, where four marks on one line cannot each hold a {@link FIGURE_MIN_PX}
 * figure.
 */
export function gaugeStackedSizes(
  available: number,
  macroCap: number
): GaugeStripSizes {
  const macroRow = 6 + 2 * (2 * GAP_RATIO);
  const macroRadius = Math.floor(
    Math.min(Math.max(available / macroRow, MACRO_MIN_RADIUS), macroCap)
  );
  const calorieRadius = Math.floor(
    Math.min(macroRadius * CALORIE_RATIO, available / 2)
  );
  const gap = Math.floor(macroRadius * 2 * GAP_RATIO);

  return {
    calorieRadius,
    macroRadius,
    gap,
    width: 6 * macroRadius + 2 * gap,
    wraps: true,
  };
}
