import { describe, expect, it } from 'vitest';
import {
  arcPoint,
  GAUGE_END_ANGLE,
  gaugeHeight,
  gaugePaths,
  gaugeTipOffset,
} from '@/lib/core/ui/gauge-arc-geometry';

/**
 * The reference dial, read off the rendered source component rather than
 * re-derived here: centre (268, 96), inner 54, outer 72, cornerRadius 8,
 * paddingAngle 4, 210° → −30°, filled to 84%.
 *
 * These are the SAME numbers `gauge_arc_geometry_test.dart` pins the Flutter
 * implementation to. The two platforms draw this dial from two files, and the
 * only thing keeping them the same shape is that both answer to this fixture —
 * so if you change one, change both, and if you cannot, the drift is real.
 */
const CENTER = { x: 268, y: 96 };
const OUTER_RADIUS = 72;

interface Segment {
  op: 'M' | 'L' | 'A';
  /** Arc radius; absent on move/line. */
  radius?: number;
  /** The two arc flags, which are shape, not size — they never scale. */
  flags?: [number, number];
  x: number;
  y: number;
}

/**
 * The path as its commands, so a claim can be made about the points without
 * the `A` command's rotation and flags being mistaken for coordinates.
 */
function parsePath(path: string): Segment[] {
  return path
    .split(/(?=[MLAZ])/)
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== 'Z')
    .map((part) => {
      const [op, ...rest] = part.split(/\s+/);
      const n = rest.map(Number);
      if (op === 'A') {
        const [radius, , , largeArc, sweep, x, y] = n;
        return {
          op: 'A' as const,
          radius,
          flags: [largeArc, sweep] as [number, number],
          x,
          y,
        };
      }
      return { op: op as 'M' | 'L', x: n[0], y: n[1] };
    });
}

/** The `M x y` the path opens on — the point the first corner circle meets. */
function startOf(path: string): { x: number; y: number } {
  const [first] = parsePath(path);
  return { x: first.x, y: first.y };
}

/**
 * How wide the path's own points span. Only ever compared against another
 * width from the same fixture, so the arcs bulging past their endpoints is a
 * constant, not an error.
 */
function spanOf(path: string): number {
  const xs = parsePath(path).map((segment) => segment.x);
  return Math.max(...xs) - Math.min(...xs);
}

describe('gaugePaths', () => {
  it('starts where the source component starts', () => {
    const { filled } = gaugePaths(CENTER, OUTER_RADIUS, 0.84);
    const start = startOf(filled);

    expect(start.x).toBeCloseTo(213.0091, 2);
    expect(start.y).toBeCloseTo(127.749, 2);
  });

  it('reaches the sector’s own extremes and stops short of the circle', () => {
    const { filled } = gaugePaths(CENTER, OUTER_RADIUS, 0.84);
    const xs = parsePath(filled).map((segment) => segment.x);

    // 180° at radius 72 is the sector's left edge; nothing may sit outside it.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(CENTER.x - OUTER_RADIUS);
    // The far end stops short of the full circle — 84%, not 100%.
    expect(Math.max(...xs)).toBeLessThan(CENTER.x + OUTER_RADIUS);
  });

  it('draws the remainder as a separate pill, not a track behind the fill', () => {
    const { filled, remainder } = gaugePaths(CENTER, OUTER_RADIUS, 0.84);
    const gap = Math.hypot(
      startOf(remainder).x - startOf(filled).x,
      startOf(remainder).y - startOf(filled).y
    );

    // A 4° gap sits between them, so the two never share an edge.
    expect(gap).toBeGreaterThan(1);
  });

  it('drops the segment that has no sweep left', () => {
    const empty = gaugePaths(CENTER, OUTER_RADIUS, 0);
    expect(empty.filled).toBe('');
    expect(empty.remainder).not.toBe('');

    const full = gaugePaths(CENTER, OUTER_RADIUS, 1);
    expect(full.filled).not.toBe('');
    expect(full.remainder).toBe('');
  });

  it('draws a fill for a barely-started day', () => {
    // 60 kcal of 1,844 — the day that reported this bug. Its sweep is 7.7°,
    // far under the ~15.3° the nominal corners need, so the fill used to be
    // dropped and every dial read as untouched.
    for (const radius of [104, 44, 30]) {
      expect(
        gaugePaths(CENTER, radius, 60 / 1844).filled,
        `no fill at 3.25% on a dial of radius ${radius}`
      ).not.toBe('');
    }
  });

  it('keeps small values proportional rather than snapping to a floor', () => {
    const spans = [0.03, 0.04, 0.06, 0.1].map((progress) =>
      spanOf(gaugePaths(CENTER, OUTER_RADIUS, progress).filled)
    );
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]).toBeGreaterThan(spans[i - 1]);
    }
  });

  it('leaves a nearly-finished day the track it has left', () => {
    // The mirror of the same guard: above ~93.5% the remainder used to be
    // dropped, so a 96% day rendered as a completely full dial.
    const paths = gaugePaths(CENTER, OUTER_RADIUS, 0.96);
    expect(paths.remainder).not.toBe('');
    expect(paths.filled).not.toBe('');
  });

  it('holds its proportions when scaled at a small value', () => {
    // The fitted corner is derived from the radii, so it has to stay a pure
    // ratio down where it is doing the fitting.
    const small = parsePath(gaugePaths({ x: 0, y: 0 }, 36, 0.03).filled);
    const large = parsePath(gaugePaths({ x: 0, y: 0 }, 72, 0.03).filled);
    expect(large.length).toBeGreaterThan(0);
    expect(small).toHaveLength(large.length);
    small.forEach((segment, i) => {
      expect(segment.x * 2).toBeCloseTo(large[i].x, 2);
      expect(segment.y * 2).toBeCloseTo(large[i].y, 2);
    });
  });

  it('draws nothing for a zero target rather than a path of NaNs', () => {
    const paths = gaugePaths(CENTER, OUTER_RADIUS, Number.NaN);
    expect(paths.filled).toBe('');
    expect(paths.remainder).not.toContain('NaN');
  });

  it('clamps past target rather than sweeping round twice', () => {
    expect(gaugePaths(CENTER, OUTER_RADIUS, 1.6).filled).toBe(
      gaugePaths(CENTER, OUTER_RADIUS, 1).filled
    );
  });

  it('holds its proportions when scaled', () => {
    const origin = { x: 0, y: 0 };
    const small = parsePath(gaugePaths(origin, 36, 0.84).filled);
    const large = parsePath(gaugePaths(origin, 72, 0.84).filled);

    expect(small).toHaveLength(large.length);
    for (const [i, segment] of small.entries()) {
      // Same commands, same flags, every length doubled — one shape at two
      // sizes, which is what lets the macro dials be the calorie dial small.
      expect(segment.op).toBe(large[i].op);
      expect(segment.flags).toEqual(large[i].flags);
      expect(segment.x * 2).toBeCloseTo(large[i].x, 2);
      expect(segment.y * 2).toBeCloseTo(large[i].y, 2);
      if (segment.radius !== undefined) {
        expect(segment.radius * 2).toBeCloseTo(large[i].radius as number, 2);
      }
    }
  });
});

describe('gaugeTipOffset', () => {
  it('is where the arc actually ends', () => {
    expect(gaugeTipOffset(104)).toBe(52);
    // 210° and −30° both sit at sin = −0.5, so the tips are exactly r/2 below
    // the centre — the offset is that fact, not a tuned constant.
    expect(
      arcPoint(CENTER, OUTER_RADIUS, GAUGE_END_ANGLE).y - CENTER.y
    ).toBeCloseTo(gaugeTipOffset(OUTER_RADIUS), 2);
  });
});

describe('gaugeHeight', () => {
  it('covers the cap that hangs below the tips', () => {
    expect(gaugeHeight(72)).toBeCloseTo(117, 5);
    expect(gaugeHeight(52)).toBeCloseTo(84.5, 5);
  });
});
