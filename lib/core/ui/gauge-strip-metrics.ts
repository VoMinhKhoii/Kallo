import {
  gaugeReadoutHeights,
  type ReadoutKind,
} from '@/components/shared/gauge/gauge-lines';
import { gaugeMetaSize } from '@/lib/core/ui/gauge-figure-size';
import { gaugeReadoutLayout } from '@/lib/core/ui/gauge-readout-layout';
import {
  type GaugeStripSizes,
  gaugeStackedSizes,
  gaugeStripSizes,
} from '@/lib/core/ui/gauge-strip-layout';

/**
 * What the strip MEASURES — the arithmetic behind a row of dials, with no JSX.
 *
 * Kept apart from the component for the same reason `gaugeReadoutLayout` is:
 * these are the rules, and asserting a rule through rendered style strings is
 * how the last one went untested. `gauge-strip-layout.ts` decides how big the
 * marks are; this decides where they sit once a macro dial carries a label its
 * calorie neighbour does not.
 */

/** The gap between a macro's label and its arc. */
export const LABEL_GAP = 2;

/** The break between the two rows when the strip wraps. */
export const STACK_GAP = 20;

export interface StripLayout extends GaugeStripSizes {
  stacked: boolean;
}

/** Four marks on one line, or — on a card too narrow for that — two. */
export function sizeStrip(available: number, macroCap: number): StripLayout {
  const oneLine = gaugeStripSizes(available, macroCap);
  return oneLine.wraps
    ? { ...gaugeStackedSizes(available, macroCap), stacked: true }
    : { ...oneLine, stacked: false };
}

/**
 * The biggest the strip can get on this surface — what an unmeasured render
 * reserves, since the cap is the ceiling however wide the column turns out.
 */
export const sizeAtCap = (macroCap: number) =>
  sizeStrip(Number.POSITIVE_INFINITY, macroCap);

/** A macro label's own line box, above its arc. */
export const labelLineHeight = (radius: number) =>
  Math.round(gaugeMetaSize(radius) * 1.3);

/** Where a dial's arc centre sits below the top of its box. */
function arcCentre(radius: number, kind: ReadoutKind): number {
  const box = gaugeReadoutLayout(radius, gaugeReadoutHeights(radius, kind));
  const label = kind === 'macro' ? labelLineHeight(radius) + LABEL_GAP : 0;
  return label + box.arcTop + radius;
}

/** The whole height a dial's box takes, label included. */
function boxHeight(radius: number, kind: ReadoutKind): number {
  const box = gaugeReadoutLayout(radius, gaugeReadoutHeights(radius, kind));
  const label = kind === 'macro' ? labelLineHeight(radius) + LABEL_GAP : 0;
  return label + box.height;
}

/**
 * How far each side of the row drops so the two arcs share a centre line.
 *
 * Only one of the two is ever non-zero — whichever mark's centre sits higher in
 * its own box gets pushed down to meet the other. Without this every macro arc
 * hangs below the calorie arc by the height of its label, and the row reads as
 * two unrelated rows of marks.
 */
export function alignCentres({
  calorieRadius,
  macroRadius,
}: Pick<StripLayout, 'calorieRadius' | 'macroRadius'>) {
  const calorie = arcCentre(calorieRadius, 'calorie');
  const macro = arcCentre(macroRadius, 'macro');
  return {
    calorieShift: Math.max(0, macro - calorie),
    macroShift: Math.max(0, calorie - macro),
  };
}

/** What the row measures once both sides are aligned — the placeholder's height. */
export function stripHeight(sizes: StripLayout): number {
  const calorie = boxHeight(sizes.calorieRadius, 'calorie');
  const macro = boxHeight(sizes.macroRadius, 'macro');

  if (sizes.stacked) return calorie + STACK_GAP + macro;
  const { calorieShift, macroShift } = alignCentres(sizes);
  return Math.max(calorieShift + calorie, macroShift + macro);
}
