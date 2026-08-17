/**
 * Loaders that are not about food — they are just alive: a travelling wave, a
 * bouncing ball, a monitor trace, squares turning, blocks climbing, jelly, and
 * a dash chasing its own tail.
 *
 * This app's own, kept in step with the Flutter painters in
 * `widgets/loaders/motion/`, which draw the same geometry.
 */

import {
  clamp,
  easeIn,
  easeInOut,
  easeOut,
  ellipse,
  type LoaderSpec,
  loaderPhase,
  roundRect,
  withAlpha,
} from '@/lib/core/ui/loaders/loader-math';

const TAU = Math.PI * 2;

/** Five dots riding a sine wave. */
export const waveLoader: LoaderSpec = {
  id: 'wave',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.1);
    const count = 5;
    const step = 34 / (count - 1);
    for (let i = 0; i < count; i++) {
      // Each dot lags the one before, so the crest travels rather than pulsing.
      const phase = (p - i * 0.09) * TAU;
      withAlpha(ctx, color, 0.55 + 0.45 * Math.sin(phase));
      ellipse(
        ctx,
        (3 + i * step) * s,
        (20 + Math.sin(phase) * 9) * s,
        3 * s,
        3 * s
      );
      ctx.fill();
    }
  },
};

/** A ball bouncing, squashing as it lands and stretching as it leaves. */
export const bounceLoader: LoaderSpec = {
  id: 'bounce',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 0.75);
    // |cos| gives the true parabola-ish bounce with a sharp turn at the floor.
    const height = (Math.cos(p * TAU) + 1) / 2; // 1 at top, 0 at floor
    const cy = 30 - 20 * height;
    // Squash only in the last of the descent, and conserve area.
    const squash = height < 0.12 ? 1 + (0.12 - height) * 2.2 : 1;
    const rx = 6.5 * squash;
    const ry = 6.5 / squash;

    withAlpha(ctx, color, 1);
    ellipse(ctx, 20 * s, (cy + (6.5 - ry)) * s, rx * s, ry * s);
    ctx.fill();

    // The floor it is working against.
    withAlpha(ctx, color, 0.3);
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8 * s, 37 * s);
    ctx.lineTo(32 * s, 37 * s);
    ctx.stroke();
  },
};

/**
 * A rounded square wobbling like set jelly — squash and stretch on one axis,
 * then the other.
 */
export const jellyLoader: LoaderSpec = {
  id: 'jelly',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.2);
    // A decaying wobble, reset each cycle.
    const wobble = Math.sin(p * 2 * TAU) * (1 - p) * 0.28;
    const w = 20 * (1 + wobble);
    const h = 20 * (1 - wobble);
    const cy = 20 * s + ((20 - h) / 2) * s;

    withAlpha(ctx, color, 1);
    roundRect(ctx, 20 * s - (w / 2) * s, cy - (h / 2) * s, w * s, h * s, 6 * s);
    ctx.fill();
  },
};

/**
 * A pulse tracing across a monitor line and resetting.
 * The trace, as (x, y) in a 40-box: flat, then the spike, then flat.
 */
const ECG_TRACE: [number, number][] = [
  [2, 20],
  [12, 20],
  [15, 13],
  [18, 30],
  [21, 7],
  [24, 20],
  [38, 20],
];

export const ecgLoader: LoaderSpec = {
  id: 'ecg',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.6);
    const headX = 2 + 36 * p;

    ctx.beginPath();
    ctx.moveTo(ECG_TRACE[0][0] * s, ECG_TRACE[0][1] * s);
    for (let i = 1; i < ECG_TRACE.length; i++) {
      const [ax, ay] = ECG_TRACE[i - 1];
      const [bx, by] = ECG_TRACE[i];
      if (bx <= headX) {
        ctx.lineTo(bx * s, by * s);
        continue;
      }
      // Stop mid-segment at the head, interpolating so the line grows smoothly.
      const t = clamp((headX - ax) / (bx - ax), 0, 1);
      ctx.lineTo((ax + (bx - ax) * t) * s, (ay + (by - ay) * t) * s);
      break;
    }
    // Fades out over the last fifth so the reset is not a hard cut.
    withAlpha(ctx, color, p > 0.8 ? (1 - p) / 0.2 : 1);
    ctx.lineWidth = 2.2 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  },
};

/**
 * A dash chasing its own tail round a rounded track — the one nod to a
 * spinner, but on a track rather than a circle.
 */
export const dashLoader: LoaderSpec = {
  id: 'dash',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.4);

    withAlpha(ctx, color, 0.22);
    ctx.lineWidth = 2.2 * s;
    roundRect(ctx, 5 * s, 11 * s, 30 * s, 18 * s, 9 * s);
    ctx.stroke();

    // The dash grows and shrinks as it travels, so it never reads as a
    // constant-speed spinner. Canvas has no path-metric API, so the travelling
    // slice is drawn with a dash pattern offset round the same track.
    const perimeter = 2 * (30 - 18) * s + Math.PI * 9 * s * 2;
    const span = perimeter * (0.12 + 0.16 * (0.5 + 0.5 * Math.sin(p * TAU)));
    withAlpha(ctx, color, 1);
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = 'round';
    ctx.setLineDash([span, perimeter - span]);
    ctx.lineDashOffset = -perimeter * p;
    roundRect(ctx, 5 * s, 11 * s, 30 * s, 18 * s, 9 * s);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  },
};

/** Three squares turning over in sequence, each edge-on at its midpoint. */
const FLIP_X = [8, 20, 32];

export const flipSquaresLoader: LoaderSpec = {
  id: 'flip-squares',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    withAlpha(ctx, color, 1);
    for (let i = 0; i < FLIP_X.length; i++) {
      // Each square gets its own third of the cycle to turn in.
      const p = loaderPhase(seconds, 1.5, (-i * 1.5) / 6);
      // Turn over the first half, rest the second.
      const turn = p < 0.5 ? easeInOut(p / 0.5) : 1;
      const w = clamp(Math.abs(Math.cos(turn * Math.PI)), 0.06, 1);
      ctx.save();
      ctx.translate(FLIP_X[i] * s, 20 * s);
      ctx.scale(w, 1);
      roundRect(ctx, -4.5 * s, -4.5 * s, 9 * s, 9 * s, 2.2 * s);
      ctx.fill();
      ctx.restore();
    }
  },
};

/** Blocks climbing a staircase — one steps up as the last steps down. */
export const ladderLoader: LoaderSpec = {
  id: 'ladder',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const p = loaderPhase(seconds, 1.2, (-i * 1.2) / count);
      // Up fast, hold, down slow: a step rather than a bob.
      const lift =
        p < 0.3 ? easeOut(p / 0.3) : p < 0.7 ? 1 : 1 - easeIn((p - 0.7) / 0.3);
      const h = 8 + 14 * lift;
      withAlpha(ctx, color, 0.45 + 0.55 * lift);
      roundRect(ctx, (5 + i * 8.5) * s, (30 - h) * s, 6 * s, h * s, 2.4 * s);
      ctx.fill();
    }
  },
};
