import {
  type FigureKind,
  gaugeFigureSize,
  gaugeLineHeight,
  gaugeMetaSize,
  gaugeUnitSize,
} from '@/lib/core/ui/gauge-figure-size';

/**
 * The readout a dial draws in its mouth, as a whole.
 *
 * A dial's readout is a fixed stack of ROLES, not a list of lines — a calorie
 * dial always draws figure / unit / detail, a macro dial always draws figure /
 * target — so this file composes the whole stack rather than exporting one
 * constructor per line. That is what lets the sizes be decided in ONE place:
 * the two components hand over strings, and nothing outside this file has an
 * opinion about how big any of them is.
 *
 * Sizes come from the arc (`lib/core/ui/gauge-figure-size.ts`); heights are
 * stated here beside them because `gaugeReadoutLayout` measures the stack
 * before the browser lays it out, and a measured height that drifts from the
 * rendered one slides every line off the arc's tips.
 */

export interface GaugeLine {
  text: string;
  className: string;
  heightPx: number;
  fontSizePx: number;
}

/** The leading the two short lines carry above their own font size. */
const SHORT_LINE_LEADING = 4;

const FIGURE_CLASS =
  'font-sans-display font-medium text-kallo-text tabular-nums tracking-[-0.02em]';
const UNIT_CLASS = 'font-sans-display text-kallo-text-muted';
const META_CLASS = 'font-sans-display text-kallo-text-muted tabular-nums';
const META_OVER_CLASS =
  'font-sans-display font-medium text-kallo-danger tabular-nums';

/**
 * Every size one readout uses, decided together.
 *
 * The calorie detail line is bounded by the unit line above it. On their own
 * curves the detail (0.25r) overtakes the unit (0.18r, held down by the tip
 * opening the long wording has to clear) from about r45 to r77 — which is
 * exactly where both surfaces land, and it reads as the quiet line shouting
 * over the one that names the figure. Flutter's dial sets unit 14 over detail
 * 12; this keeps that order at every radius. A macro dial has no unit line, so
 * its target is bounded by nothing.
 */
function readoutSizes(radius: number, dial: FigureKind) {
  const unit = gaugeUnitSize(radius);
  const meta = gaugeMetaSize(radius);
  return {
    figure: gaugeFigureSize(radius, dial),
    unit,
    meta: dial === 'calorie' ? Math.min(unit, meta) : meta,
  };
}

const figureLine = (text: string, fontSizePx: number): GaugeLine => ({
  text,
  className: FIGURE_CLASS,
  fontSizePx,
  heightPx: gaugeLineHeight(fontSizePx),
});

const shortLine = (
  text: string,
  fontSizePx: number,
  className: string
): GaugeLine => ({
  text,
  className,
  fontSizePx,
  heightPx: fontSizePx + SHORT_LINE_LEADING,
});

export interface CalorieReadout {
  primary: GaugeLine;
  secondary: GaugeLine;
  tertiary: GaugeLine;
}

/**
 * The day's figure, what it is in words, and the detail under the arc.
 *
 * `over` swaps the detail's pigment: past target that line carries the
 * overshoot, and a terracotta figure is the only thing separating "375 over
 * 1,844" from any other fraction at a glance. It does not change the line box.
 */
export function gaugeCalorieLines(
  { figure, unit, detail }: { figure: string; unit: string; detail: string },
  radius: number,
  over = false
): CalorieReadout {
  const size = readoutSizes(radius, 'calorie');
  return {
    primary: figureLine(figure, size.figure),
    // Words, not figures, so it is the one line without tabular numerals.
    secondary: shortLine(unit, size.unit, UNIT_CLASS),
    tertiary: shortLine(detail, size.meta, over ? META_OVER_CLASS : META_CLASS),
  };
}

export interface MacroReadout {
  primary: GaugeLine;
  secondary: GaugeLine;
}

/** A macro's grams, over the target it is counting toward. */
export function gaugeMacroLines(
  { figure, target }: { figure: string; target: string },
  radius: number
): MacroReadout {
  const size = readoutSizes(radius, 'macro');
  return {
    primary: figureLine(figure, size.figure),
    secondary: shortLine(target, size.meta, META_CLASS),
  };
}

/**
 * The heights a dial's readout resolves to, without building its strings.
 *
 * A caller aligning two dials by their arc centres needs the stack's shape
 * before it knows any of the copy. Derived from the same `readoutSizes`, so it
 * can never disagree with what the dial renders.
 */
export function gaugeReadoutHeights(
  radius: number,
  dial: FigureKind
): number[] {
  const size = readoutSizes(radius, dial);
  const figure = gaugeLineHeight(size.figure);
  const meta = size.meta + SHORT_LINE_LEADING;
  return dial === 'calorie'
    ? [figure, size.unit + SHORT_LINE_LEADING, meta]
    : [figure, meta];
}
