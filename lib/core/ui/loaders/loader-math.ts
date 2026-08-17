/**
 * SMIL sampling helpers shared by every loader painter.
 *
 * The loaders are ports of SMIL `<animate>` elements, where each element runs
 * on its OWN duration and may pre-roll with a negative `begin`. These helpers
 * reproduce that per-element timing from one monotonic clock, so a loader with
 * four differently-timed bars needs no common period.
 *
 * Kept identical to the Flutter side (`loader_math.dart`) — the two platforms
 * draw the same pool, and any drift here is drift in the artwork.
 */

/**
 * Fraction through `dur` for an element that started at `begin` seconds.
 * A negative `begin` pre-rolls, exactly as SMIL does. Always in `[0, 1)`.
 */
export function loaderPhase(seconds: number, dur: number, begin = 0): number {
  if (dur <= 0) return 0;
  const t = (seconds - begin) % dur;
  return (t < 0 ? t + dur : t) / dur;
}

/**
 * `calcMode="linear"` sampling of a SMIL `values` list, whose keyframes are
 * evenly spaced across the duration.
 */
export function sampleLinear(values: number[], phase: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const p = clamp(phase, 0, 1);
  const segments = values.length - 1;
  const x = p * segments;
  const i = Math.min(Math.max(Math.floor(x), 0), segments - 1);
  return values[i] + (values[i + 1] - values[i]) * (x - i);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * A cubic-bezier easing, the same curve SVG `keySplines` and CSS
 * `cubic-bezier()` describe. Solves x(t) = p for t by bisection — the curves
 * here are all monotonic in x, and 24 halvings is well under a pixel of error
 * at any size a loader is drawn.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (t: number) => number {
  const curve = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  return (p: number) => {
    const target = clamp(p, 0, 1);
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (curve(x1, x2, mid) < target) lo = mid;
      else hi = mid;
    }
    return curve(y1, y2, (lo + hi) / 2);
  };
}

/** Flutter's `Curves.easeIn` / `easeOut` / `easeInOut`, to the same control points. */
export const easeIn = cubicBezier(0.42, 0, 1, 1);
export const easeOut = cubicBezier(0, 0, 0.58, 1);
export const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

/** Draws one frame of a loader into `ctx`, sized `width` × `height`. */
export type LoaderPainter = (
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  seconds: number,
  color: string
) => void;

/** One loader in the pool. */
export interface LoaderSpec {
  /** Stable identifier — the upstream file name (`three-dots`, `knife-chop`). */
  readonly id: string;
  /**
   * Rendered size as a multiple of the requested size. Most loaders are square
   * (1, 1); the wide ones (three-dots is 4:1 in its viewBox) draw shorter and
   * wider so they carry the same visual weight as the squares beside them.
   */
  readonly widthFactor?: number;
  readonly heightFactor?: number;
  readonly paint: LoaderPainter;
}

/** A rounded rectangle path, the canvas equivalent of Flutter's `RRect`. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

/** An axis-aligned ellipse centred on (cx, cy) with the given half-extents. */
export function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
}

/**
 * `color` at `alpha`. The painters are handed a resolved CSS colour (the
 * computed `currentColor`), so this multiplies it rather than assuming a hex.
 */
export function withAlpha(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number
): void {
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
}
