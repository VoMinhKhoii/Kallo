/**
 * The rounded 240° gauge dial's geometry — pure path maths, no components.
 *
 * A sector with all four corners rounded, drawn as two segments (the filled
 * part and what is left) separated by a padding gap, so the remainder reads as
 * its own rounded pill rather than as a track running underneath the fill.
 *
 * The proportions are fixed rather than free parameters: band = ¼ of the outer
 * radius and corner = 4⁄9 of the band. At the reference size (outer 72) those
 * resolve to the 54/72 radii and the corner radius of 8 the dial was drawn at,
 * and they hold their look when it is scaled — the macro dials are the same
 * shape at 44.
 *
 * Angles are DEGREES in the maths convention (counter-clockwise positive, y
 * up); `arcPoint` flips y for screen space. The dial sweeps CLOCKWISE from
 * `GAUGE_START_ANGLE` down to `GAUGE_END_ANGLE`.
 *
 * Ported from `apps/mobile-flutter/lib/shared/widgets/gauge/gauge_arc_geometry.dart`
 * — same constants, same names, same sweep-fitting rule. The two files are
 * pinned to one another by a shared set of reference numbers in their tests
 * (see `__tests__/gauge-arc-geometry.test.ts`); change one and the other's
 * test tells you.
 */

/** 210° → −30°: a 240° sweep with the 60° gap centred at the bottom. */
export const GAUGE_START_ANGLE = 210;
export const GAUGE_END_ANGLE = -30;

/** The gap between the filled segment and the remainder. */
export const GAUGE_PAD_ANGLE = 4;

const BAND_RATIO = 0.25;
const CORNER_RATIO = 4 / 9;
const DEG = Math.PI / 180;

export interface Point {
  x: number;
  y: number;
}

/** A point at `radius` and `angle` (degrees, y-up) around `center`. */
export function arcPoint(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + radius * Math.cos(angle * DEG),
    y: center.y - radius * Math.sin(angle * DEG),
  };
}

interface RoundedSectorInput {
  center: Point;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  cornerRadius: number;
}

/** A sweep at or below this holds nothing at all, and draws nothing. */
const DEGENERATE_SWEEP = 0.01;

/**
 * The thinnest sliver a dial will draw for a real, non-zero value. Below this
 * the mark would be sub-pixel on the small dials and read as nothing at all;
 * exact 0 and exact 1 stay absolute.
 */
export const GAUGE_MIN_SWEEP = 3.5;

/**
 * The largest corner radius a `sweep`-wide sector can hold without its corner
 * arcs crossing.
 *
 * Each corner eats an angular inset, and the two on one edge must fit inside
 * the sweep (less the 0.5° of breathing room the shape has always kept). With
 * h the half-sweep left over and s = sin h, `asin(c / (R − c)) ≤ h` gives
 * `c ≤ sR / (1 + s)` on the outer edge and `asin(c / (r + c)) ≤ h` gives
 * `c ≤ sr / (1 − s)` on the inner; the tighter of the two wins.
 */
function cornerThatFits(
  innerRadius: number,
  outerRadius: number,
  sweep: number
): number {
  const half = ((sweep - 0.5) / 2) * DEG;
  if (half <= 0) return 0;
  const s = Math.sin(half);
  const outerFit = (s * outerRadius) / (1 + s);
  const innerFit =
    s >= 1 ? Number.POSITIVE_INFINITY : (s * innerRadius) / (1 - s);
  return Math.min(outerFit, innerFit);
}

/**
 * One rounded sector as an SVG path, sweeping clockwise from `startAngle` down
 * to `endAngle`.
 *
 * `cornerRadius` is a MAXIMUM, not a fixed size. A narrow sweep cannot hold the
 * nominal corners — the corner arcs would cross and the sector would turn
 * inside out — so the corner shrinks to the largest one that fits (see
 * `cornerThatFits`) and the sliver is drawn at its true width. Above about a
 * 15° sweep the nominal radius always fits, so a dial at any ordinary value is
 * the exact shape it has always been.
 *
 * Returns an EMPTY string only for a sweep with nothing in it, which is what 0%
 * and 100% give (one of the two segments has no sweep left).
 *
 * SVG's y axis points down, as Flutter's does, so `sweep-flag 1` is the same
 * clockwise direction `arcToPoint` takes by default.
 */
export function roundedSectorPath({
  center,
  innerRadius,
  outerRadius,
  startAngle,
  endAngle,
  cornerRadius,
}: RoundedSectorInput): string {
  const sweep = startAngle - endAngle;
  if (sweep <= DEGENERATE_SWEEP) return '';

  const c = Math.min(
    cornerRadius,
    cornerThatFits(innerRadius, outerRadius, sweep)
  );
  const outerInset = Math.asin(c / (outerRadius - c)) / DEG;
  const innerInset = Math.asin(c / (innerRadius + c)) / DEG;

  // Where each corner circle touches the sector's straight radial edge.
  const outerEdge = (outerRadius - c) * Math.cos(outerInset * DEG);
  const innerEdge = (innerRadius + c) * Math.cos(innerInset * DEG);

  const arc = (
    radius: number,
    to: Point,
    { largeArc = false, clockwise = true } = {}
  ) =>
    `A ${radius} ${radius} 0 ${largeArc ? 1 : 0} ${clockwise ? 1 : 0} ${to.x} ${to.y}`;

  const start = arcPoint(center, outerEdge, startAngle);
  const innerEnd = arcPoint(center, innerEdge, endAngle);

  return [
    `M ${start.x} ${start.y}`,
    arc(c, arcPoint(center, outerRadius, startAngle - outerInset)),
    arc(outerRadius, arcPoint(center, outerRadius, endAngle + outerInset), {
      largeArc: sweep - 2 * outerInset > 180,
    }),
    arc(c, arcPoint(center, outerEdge, endAngle)),
    `L ${innerEnd.x} ${innerEnd.y}`,
    arc(c, arcPoint(center, innerRadius, endAngle + innerInset)),
    arc(innerRadius, arcPoint(center, innerRadius, startAngle - innerInset), {
      largeArc: sweep - 2 * innerInset > 180,
      clockwise: false,
    }),
    arc(c, arcPoint(center, innerEdge, startAngle)),
    'Z',
  ].join(' ');
}

export interface GaugePaths {
  filled: string;
  remainder: string;
}

/**
 * The two halves of a dial at `progress` (0–1): what has been used, and what is
 * left. Over 1 the fill takes the whole sweep and `remainder` is empty.
 *
 * Strictly between the two, BOTH halves are held to `GAUGE_MIN_SWEEP`, so a
 * barely-started day still shows its fill and a nearly-finished one still shows
 * the track it has left. Only an exact 0 or an exact 1 empties a half.
 */
export function gaugePaths(
  center: Point,
  outerRadius: number,
  progress: number
): GaugePaths {
  const band = outerRadius * BAND_RATIO;
  const innerRadius = outerRadius - band;
  const cornerRadius = band * CORNER_RATIO;
  const span = GAUGE_START_ANGLE - GAUGE_END_ANGLE - GAUGE_PAD_ANGLE;
  // NaN (0 eaten / 0 target) survives Math.min/max and would poison every angle
  // downstream, so it reads as an untouched dial.
  const clamped = Number.isNaN(progress)
    ? 0
    : Math.min(Math.max(progress, 0), 1);
  const minShare = GAUGE_MIN_SWEEP / span;
  const shown =
    clamped <= 0
      ? 0
      : clamped >= 1
        ? 1
        : Math.min(Math.max(clamped, minShare), 1 - minShare);
  const mid = GAUGE_START_ANGLE - span * shown;

  const segment = (from: number, to: number) =>
    roundedSectorPath({
      center,
      innerRadius,
      outerRadius,
      startAngle: from,
      endAngle: to,
      cornerRadius,
    });

  return {
    filled: segment(GAUGE_START_ANGLE, mid),
    remainder: segment(mid - GAUGE_PAD_ANGLE, GAUGE_END_ANGLE),
  };
}

/** How far past the end angle the overshoot cap reaches. */
const OVERSHOOT_CAP_ANGLE = 22;

/**
 * The mark a dial wears when it is PAST its target.
 *
 * Over 1 `gaugePaths` clamps: 101% of target and 135% of target paint an
 * identical full arc, so a day that overshot read exactly like a day that
 * landed. This is a short sector at the sweep's very end, drawn over the fill
 * in a warning pigment, so "past it" is visible without the arc having to
 * lie about how far past.
 *
 * Web-only for now — the Flutter dial does not draw it yet, so this is the one
 * place `gauge_arc_geometry.dart` has no counterpart.
 */
export function gaugeOvershootCapPath(
  center: Point,
  outerRadius: number
): string {
  const band = outerRadius * BAND_RATIO;
  return roundedSectorPath({
    center,
    innerRadius: outerRadius - band,
    outerRadius,
    startAngle: GAUGE_END_ANGLE + OVERSHOOT_CAP_ANGLE,
    endAngle: GAUGE_END_ANGLE,
    cornerRadius: band * CORNER_RATIO,
  });
}

/**
 * Where the dial's two tips sit below its centre — the line a readout's second
 * line is centred on, so type and dial share one baseline.
 */
export function gaugeTipOffset(outerRadius: number): number {
  return outerRadius / 2;
}

/**
 * How tall the dial draws at `outerRadius`: the top half, the drop to the tips,
 * and the rounded cap that hangs below them.
 */
export function gaugeHeight(outerRadius: number): number {
  return outerRadius + gaugeTipOffset(outerRadius) + outerRadius / 8;
}
