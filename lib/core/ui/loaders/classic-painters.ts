/**
 * The non-circular survivors of the SVG-Loaders collection
 * (https://github.com/SamHerbert/SVG-Loaders, MIT), drawn from the same value
 * lists the upstream SMIL uses.
 *
 * These five are the ones that read as motion rather than as a spinner; the
 * puff / oval / tail-spin / ball-triangle members of the set were retired.
 */

import {
  ellipse,
  type LoaderSpec,
  loaderPhase,
  roundRect,
  sampleLinear,
  withAlpha,
} from '@/lib/core/ui/loaders/loader-math';

/** Five equalizer bars, the outer pairs trailing the centre. */
const BARS_HEIGHTS = [120, 110, 100, 90, 80, 70, 60, 50, 40, 140, 120];
const BARS_YS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 0, 10];
/** (x, begin) — the centre bar leads, each pair out from it trailing further. */
const BARS: [number, number][] = [
  [0, 0.5],
  [30, 0.25],
  [60, 0],
  [90, 0.25],
  [120, 0.5],
];

export const barsLoader: LoaderSpec = {
  id: 'bars',
  paint: (ctx, size, seconds, color) => {
    const sx = size.width / 135;
    const sy = size.height / 140;
    withAlpha(ctx, color, 1);
    for (const [x, begin] of BARS) {
      const p = loaderPhase(seconds, 1, begin);
      roundRect(
        ctx,
        x * sx,
        sampleLinear(BARS_YS, p) * sy,
        15 * sx,
        sampleLinear(BARS_HEIGHTS, p) * sy,
        6 * sx
      );
      ctx.fill();
    }
  },
};

/**
 * Four bars metering off a signal — each on its own duration, so they never
 * fall into step. Bars grow upwards from the baseline.
 */
const AUDIO_BARS: [number, number, number[]][] = [
  [
    0,
    4.3,
    [
      20, 45, 57, 80, 64, 32, 66, 45, 64, 23, 66, 13, 64, 56, 34, 34, 2, 23, 76,
      79, 20,
    ],
  ],
  [15, 2, [80, 55, 33, 5, 75, 23, 73, 33, 12, 14, 60, 80]],
  [30, 1.4, [50, 34, 78, 23, 56, 23, 34, 76, 80, 54, 21, 50]],
  [45, 2, [30, 45, 13, 80, 56, 72, 45, 76, 34, 23, 67, 30]],
];

export const audioLoader: LoaderSpec = {
  id: 'audio',
  widthFactor: 0.6875, // 55:80
  paint: (ctx, size, seconds, color) => {
    const sx = size.width / 55;
    const sy = size.height / 80;
    withAlpha(ctx, color, 1);
    for (const [x, dur, heights] of AUDIO_BARS) {
      const h = sampleLinear(heights, loaderPhase(seconds, dur));
      // The upstream group is flipped vertically, so bars rise from the floor.
      roundRect(ctx, x * sx, (80 - h) * sy, 10 * sx, h * sy, 3 * sx);
      ctx.fill();
    }
  },
};

/**
 * Three dots pulsing in radius and opacity. Wider than tall (4:1 viewBox), so
 * it renders short and wide to hold its own beside the square loaders.
 */
const DOT_R_OUTER = [15, 9, 15];
const DOT_R_INNER = [9, 15, 9];
const DOT_O_OUTER = [1, 0.5, 1];
const DOT_O_INNER = [0.5, 1, 0.5];

export const threeDotsLoader: LoaderSpec = {
  id: 'three-dots',
  widthFactor: 1.5,
  heightFactor: 0.375,
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 120;
    const p = loaderPhase(seconds, 0.8);
    const dot = (cx: number, radii: number[], opacities: number[]) => {
      withAlpha(ctx, color, sampleLinear(opacities, p));
      const r = sampleLinear(radii, p) * s;
      ellipse(ctx, cx * s, 15 * s, r, r);
      ctx.fill();
    };
    dot(15, DOT_R_OUTER, DOT_O_OUTER);
    dot(60, DOT_R_INNER, DOT_O_INNER);
    dot(105, DOT_R_OUTER, DOT_O_OUTER);
  },
};

/**
 * A 3x3 grid of twinkling dots.
 * (cx, cy, begin) — the upstream stagger, which is deliberately not a
 * left-to-right sweep.
 */
const GRID_DOTS: [number, number, number][] = [
  [12.5, 12.5, 0],
  [12.5, 52.5, 0.1],
  [52.5, 12.5, 0.3],
  [52.5, 52.5, 0.6],
  [92.5, 12.5, 0.8],
  [92.5, 52.5, 0.4],
  [12.5, 92.5, 0.7],
  [52.5, 92.5, 0.5],
  [92.5, 92.5, 0.2],
];
const GRID_OPACITY = [1, 0.2, 1];

export const gridLoader: LoaderSpec = {
  id: 'grid',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 105;
    for (const [cx, cy, begin] of GRID_DOTS) {
      const p = loaderPhase(seconds, 1, begin);
      withAlpha(ctx, color, sampleLinear(GRID_OPACITY, p));
      ellipse(ctx, cx * s, cy * s, 12.5 * s, 12.5 * s);
      ctx.fill();
    }
  },
};

/**
 * Three hearts breathing in and out of step. The only path-based loader.
 * (centre x, begin) in the 140x64 viewBox — the middle heart is deliberately
 * NOT the middle of the stagger.
 */
const HEARTS: [number, number][] = [
  [28, 0],
  [65, 0.3],
  [102, 0.7],
];
const HEARTS_OPACITY = [0.5, 1, 0.5];

/**
 * A heart inscribed in the given box: two lobes meeting at a dimple on the top
 * edge, their outer walls sweeping down to the point.
 */
function heartPath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number
): void {
  const cx = left + w / 2;
  const right = left + w;
  const bottom = top + h;
  const dimpleY = top + h * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, dimpleY);
  // Left lobe, then down the left wall to the tip.
  ctx.bezierCurveTo(
    left + w * 0.42,
    top,
    left,
    top + h * 0.05,
    left,
    top + h * 0.35
  );
  ctx.bezierCurveTo(
    left,
    top + h * 0.62,
    left + w * 0.28,
    top + h * 0.78,
    cx,
    bottom
  );
  // Right wall back up, then the right lobe home.
  ctx.bezierCurveTo(
    right - w * 0.28,
    top + h * 0.78,
    right,
    top + h * 0.62,
    right,
    top + h * 0.35
  );
  ctx.bezierCurveTo(right, top + h * 0.05, right - w * 0.42, top, cx, dimpleY);
  ctx.closePath();
}

export const heartsLoader: LoaderSpec = {
  id: 'hearts',
  widthFactor: 1.09375, // 140:64, drawn at half height
  heightFactor: 0.5,
  paint: (ctx, size, seconds, color) => {
    const sx = size.width / 140;
    const sy = size.height / 64;
    for (const [cx, begin] of HEARTS) {
      const p = loaderPhase(seconds, 1.4, begin);
      withAlpha(ctx, color, sampleLinear(HEARTS_OPACITY, p));
      heartPath(ctx, (cx - 25) * sx, 8 * sy, 50 * sx, 48 * sy);
      ctx.fill();
    }
  },
};
