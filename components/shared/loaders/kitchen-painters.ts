/**
 * Loaders that look like cooking: steam off a bowl, a pot coming to the boil,
 * a pan tossing, a whisk working, a knife on a board, grains falling, a pour.
 *
 * This app's own, not from the SVG-Loaders set — kept in step with the Flutter
 * painters in `widgets/loaders/kitchen/`, which draw the same geometry.
 */

import {
  clamp,
  easeIn,
  easeOut,
  ellipse,
  type LoaderSpec,
  loaderPhase,
  roundRect,
  withAlpha,
} from '@/components/shared/loaders/loader-math';

const TAU = Math.PI * 2;

/** Three wisps of steam rising and thinning out — the phở-bowl loader. */
const WISPS: [number, number][] = [
  [11, 0],
  [20, -0.8],
  [29, -1.6],
];

export const steamLoader: LoaderSpec = {
  id: 'steam',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    ctx.lineCap = 'round';
    withAlpha(ctx, color, 1);

    // The rim it comes off, so the wisps read as steam and not as squiggles.
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.ellipse(20 * s, 33 * s, 12 * s, 6 * s, 0, 0, Math.PI);
    ctx.stroke();

    ctx.lineWidth = 2 * s;
    for (const [x, begin] of WISPS) {
      const p = loaderPhase(seconds, 2.4, begin);
      // A wisp 14 tall that climbs 16 and fades as it goes.
      const base = 29 - 16 * p;
      ctx.beginPath();
      ctx.moveTo(x * s, base * s);
      // A full S over its own length — one crossing each way, which is what
      // makes it read as steam rather than as a wavy line.
      for (let t = 0.05; t <= 1.0001; t += 0.05) {
        const dx = Math.sin(t * TAU) * 3.2 * s;
        ctx.lineTo(x * s + dx, (base - 14 * t) * s);
      }
      // Fade in off the rim, out at the top — never a hard pop at either end.
      const alpha = clamp(p < 0.2 ? p / 0.2 : (1 - p) / 0.8, 0, 1);
      withAlpha(ctx, color, alpha * 0.9);
      ctx.stroke();
    }
  },
};

/**
 * A pot coming to the boil: bubbles rise, swell and pop at the surface.
 * (x, begin, radius) in a 40-box.
 */
const BUBBLES: [number, number, number][] = [
  [10, 0, 3.4],
  [20, -0.7, 4.6],
  [30, -1.3, 2.8],
  [15, -1.7, 2.2],
];

export const bubblesLoader: LoaderSpec = {
  id: 'bubbles',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    for (const [x, begin, r] of BUBBLES) {
      const p = loaderPhase(seconds, 1.9, begin);
      // Rise from the floor to the surface, swelling as the pressure drops.
      const y = 34 - 28 * p;
      const radius = r * (0.55 + 0.45 * p);
      // The last fifth is the pop: it thins to a ring and vanishes.
      const popping = p > 0.8;
      const t = popping ? (p - 0.8) / 0.2 : 0;
      withAlpha(ctx, color, popping ? 1 - t : 0.85);
      const rr = (radius + (popping ? t * 2 : 0)) * s;
      ellipse(ctx, x * s, y * s, rr, rr);
      if (popping) {
        ctx.lineWidth = 1.4 * s;
        ctx.stroke();
      } else {
        ctx.fill();
      }
    }
  },
};

/**
 * A pan tossing something and catching it again. The pan dips to load, the
 * disc arcs up and turns over, then both settle.
 */
export const panFlipLoader: LoaderSpec = {
  id: 'pan-flip',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.5);
    withAlpha(ctx, color, 1);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2 * s;

    // The pan tips down to launch and rocks back — a quarter of the cycle.
    ctx.save();
    ctx.translate(20 * s, 27 * s);
    ctx.rotate(Math.sin(p * TAU) * 0.22);
    // Bowl of the pan: a shallow half-round with a handle off to the right.
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 7 * s, 0, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11 * s, 0);
    ctx.lineTo(19 * s, -3 * s);
    ctx.stroke();
    ctx.restore();

    // The food: a flattened disc on a parabola, turning over at the top.
    const hop = 4 * p * (1 - p); // 0→1→0, peaking mid-cycle
    ctx.save();
    ctx.translate(20 * s, (20 - 20 * hop) * s);
    // Squash to nothing edge-on, which is what sells the turn.
    ctx.scale(1, clamp(Math.abs(Math.cos(p * TAU)), 0.15, 1));
    ellipse(ctx, 0, 0, 6.5 * s, 3 * s);
    ctx.fill();
    ctx.restore();
  },
};

/**
 * A whisk working round a bowl — three tines orbiting, with the trail of the
 * stroke behind them.
 */
export const whiskLoader: LoaderSpec = {
  id: 'whisk',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const cx = 20 * s;
    const cy = 22 * s;
    const angle = loaderPhase(seconds, 1.1) * TAU;
    ctx.lineCap = 'round';

    // The swirl left behind: a fading arc trailing the whisk.
    withAlpha(ctx, color, 0.28);
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, 11 * s, angle - 2.2, angle);
    ctx.stroke();

    withAlpha(ctx, color, 1);
    // The bowl it works in — without it the whisk read as a lone diagonal.
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14 * s, 12 * s, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();

    // The whisk leans into the stroke: the head orbits, the grip stays up top.
    const hx = cx + Math.cos(angle) * 7 * s;
    const hy = cy + Math.sin(angle) * 4 * s;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(20 * s + Math.cos(angle) * 3 * s, 3 * s);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // The wire cage: two loops squashed toward the direction of travel.
    ctx.lineWidth = 1.4 * s;
    for (const lean of [-1, 1]) {
      ellipse(ctx, hx + lean * 2 * s, hy + 3 * s, 2.5 * s, 5 * s);
      ctx.stroke();
    }
  },
};

/**
 * A blade chopping: it lifts, comes down onto the board, and the board answers
 * with a small shudder.
 */
export const knifeChopLoader: LoaderSpec = {
  id: 'knife-chop',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 0.85);
    // Fast down (first 35%), slower lift back — a chop, not a metronome.
    const down = p < 0.35 ? easeIn(p / 0.35) : 1 - easeOut((p - 0.35) / 0.65);

    withAlpha(ctx, color, 1);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2 * s;

    // The board takes the hit right as the blade lands.
    const hit = down > 0.92 ? (down - 0.92) / 0.08 : 0;
    ctx.beginPath();
    ctx.moveTo(6 * s, (32 + hit) * s);
    ctx.lineTo(34 * s, (32 + hit) * s);
    ctx.stroke();

    // Blade: pivots at the heel so the tip travels furthest.
    ctx.save();
    ctx.translate(31 * s, 28 * s);
    ctx.rotate(0.75 * (1 - down));
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(-22 * s, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    // Handle, carried on past the heel.
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(0, -1 * s);
    ctx.lineTo(6 * s, -4 * s);
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * Grains falling into a heap — measuring something out.
 * (x, begin, lean) in a 40-box.
 */
const GRAINS: [number, number, number][] = [
  [16, 0, -0.4],
  [21, -0.45, 0.3],
  [25, -0.9, -0.15],
  [18, -1.15, 0.45],
];

export const riceFallLoader: LoaderSpec = {
  id: 'rice-fall',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;

    // The heap they are landing in.
    withAlpha(ctx, color, 0.45);
    ctx.beginPath();
    ctx.moveTo(10 * s, 34 * s);
    ctx.quadraticCurveTo(20 * s, 24 * s, 30 * s, 34 * s);
    ctx.closePath();
    ctx.fill();

    withAlpha(ctx, color, 1);
    for (const [x, begin, lean] of GRAINS) {
      const p = loaderPhase(seconds, 1.3, begin);
      // Accelerating fall, gone once it reaches the heap.
      const y = 4 + 24 * p * p;
      if (y > 28) continue;
      ctx.save();
      ctx.translate(x * s, y * s);
      ctx.rotate(lean);
      roundRect(ctx, -1.3 * s, -2.5 * s, 2.6 * s, 5 * s, 1.3 * s);
      ctx.fill();
      ctx.restore();
    }
  },
};

/** A drip from a spout, and the ring it leaves on the surface. */
export const pourDripLoader: LoaderSpec = {
  id: 'pour-drip',
  paint: (ctx, size, seconds, color) => {
    const s = size.width / 40;
    const p = loaderPhase(seconds, 1.4);

    // The vessel, tipped: a lip on the left that the drop leaves from.
    withAlpha(ctx, color, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(9 * s, 3 * s);
    ctx.lineTo(27 * s, 3 * s);
    ctx.lineTo(23 * s, 12 * s);
    ctx.lineTo(15 * s, 12 * s);
    ctx.closePath();
    ctx.stroke();

    if (p < 0.55) {
      const t = p / 0.55;
      // A teardrop: stretched while it accelerates.
      ellipse(
        ctx,
        19 * s,
        (14 + 15 * t * t) * s,
        3.25 * s,
        3.25 * s * (1 + t * 0.9)
      );
      ctx.fill();
    } else {
      // The ripple it left, spreading and fading.
      const t = (p - 0.55) / 0.45;
      withAlpha(ctx, color, 1 - t);
      ctx.lineWidth = 1.6 * s;
      ellipse(ctx, 19 * s, 32 * s, (4 + 10 * t) * s, (1.5 + 3.5 * t) * s);
      ctx.stroke();
    }
  },
};
