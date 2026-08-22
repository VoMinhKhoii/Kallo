import { gaugeHeight, gaugeTipOffset } from '@/lib/core/ui/gauge-arc-geometry';

/**
 * Where a dial's readout sits against its arc.
 *
 * The one alignment rule the app's dials share: the SECOND line's middle sits
 * on the arc's tips, so the type and the arc read as a single object rather
 * than a number parked near a shape. That is arithmetic rather than a constant
 * because the lines grow with the viewer's text size, and a fixed offset drifts
 * off the tips as soon as they do.
 *
 * Pure and separate from the component because this IS the rule — asserting it
 * through rendered style strings is how it went untested once already.
 *
 * Flutter counterpart: the same arithmetic inside
 * `shared/widgets/gauge/gauge_dial.dart`.
 */

/** The gap between the readout's stacked lines. */
export const GAUGE_LINE_GAP = 2;

export interface GaugeReadoutLayout {
  /** How far down the box the arc is painted. */
  arcTop: number;
  /** How far down the box the first line starts. */
  readoutTop: number;
  /** The height the dial must reserve for both. */
  height: number;
}

export function gaugeReadoutLayout(
  radius: number,
  lineHeights: number[]
): GaugeReadoutLayout {
  const [primary, secondary] = lineHeights;
  const readoutHeight =
    lineHeights.reduce((sum, height) => sum + height, 0) +
    GAUGE_LINE_GAP * (lineHeights.length - 1);

  // Where the readout wants to start for its second line to land on the tips.
  const wanted =
    radius + gaugeTipOffset(radius) - secondary / 2 - GAUGE_LINE_GAP - primary;

  // A small dial with tall lines wants to start ABOVE its own arc. Rather than
  // clip the headline or quietly break the alignment, the ARC drops by the
  // shortfall and the readout starts at 0: the two still share the tip line,
  // and the dial simply reserves the extra height.
  const arcTop = wanted < 0 ? -wanted : 0;
  const readoutTop = wanted + arcTop;

  return {
    arcTop,
    readoutTop,
    // The last line can hang below the arc, so the dial's own height is not
    // always the whole of it.
    height: Math.max(arcTop + gaugeHeight(radius), readoutTop + readoutHeight),
  };
}
