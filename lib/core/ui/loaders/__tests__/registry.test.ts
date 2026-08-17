import { describe, expect, it } from 'vitest';
import type { LoaderSpec } from '@/lib/core/ui/loaders/loader-math';
import {
  cubicBezier,
  loaderPhase,
  sampleLinear,
} from '@/lib/core/ui/loaders/loader-math';
import {
  loaderAt,
  pickLoaderIndex,
  STREAM_LOADERS,
} from '@/lib/core/ui/loaders/registry';

/**
 * A canvas context that records nothing and draws nothing. jsdom's canvas is a
 * stub without a 2D context, and none of these assertions are about pixels —
 * they are about the painters running their whole cycle without throwing, which
 * is exactly what a null-object context proves.
 */
function fakeContext(): CanvasRenderingContext2D {
  const noop = () => {
    /* draws nothing */
  };
  const ctx: Record<string, unknown> = {
    arc: noop,
    beginPath: noop,
    bezierCurveTo: noop,
    clearRect: noop,
    closePath: noop,
    ellipse: noop,
    fill: noop,
    lineTo: noop,
    moveTo: noop,
    quadraticCurveTo: noop,
    restore: noop,
    rotate: noop,
    roundRect: noop,
    save: noop,
    scale: noop,
    setLineDash: noop,
    setTransform: noop,
    stroke: noop,
    translate: noop,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('the loader pool', () => {
  it('is the same nineteen the Flutter app draws', () => {
    // Kept in step with `widgets/loaders/loader_registry.dart`. A loader added
    // on one platform and not the other is drift in the artwork, not a detail.
    expect(STREAM_LOADERS.map((l) => l.id).sort()).toEqual(
      [
        'audio',
        'bars',
        'bounce',
        'bubbles',
        'dash',
        'ecg',
        'flip-squares',
        'grid',
        'hearts',
        'jelly',
        'knife-chop',
        'ladder',
        'pan-flip',
        'pour-drip',
        'rice-fall',
        'steam',
        'three-dots',
        'wave',
        'whisk',
      ].sort()
    );
  });

  it('carries none of the retired spinners', () => {
    // The pool is deliberately spinner-free: circular loaders read as "the page
    // is stuck", which is the opposite of what a streaming analysis is doing.
    const ids = new Set(STREAM_LOADERS.map((l) => l.id));
    for (const retired of [
      'puff',
      'oval',
      'tail-spin',
      'spinning-circles',
      'ball-triangle',
      'circles',
    ]) {
      expect(ids.has(retired)).toBe(false);
    }
  });

  it('picks stay in range and a stale index wraps rather than throwing', () => {
    for (let i = 0; i < 50; i++) {
      const index = pickLoaderIndex();
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(STREAM_LOADERS.length);
    }
    // The index outlives the pool it was drawn from — a shorter pool after a
    // deploy must not crash the feed.
    expect(loaderAt(9999).id).toBeTruthy();
    expect(loaderAt(-1).id).toBeTruthy();
  });

  it('every loader paints across its whole cycle without throwing', () => {
    const ctx = fakeContext();
    for (const spec of STREAM_LOADERS as LoaderSpec[]) {
      for (let t = 0; t <= 5; t += 0.05) {
        expect(() =>
          spec.paint(ctx, { width: 20, height: 20 }, t, '#695E4E')
        ).not.toThrow();
      }
    }
  });
});

describe('the SMIL sampling helpers', () => {
  it('phase stays in [0,1) and wraps continuously', () => {
    expect(loaderPhase(0, 2)).toBe(0);
    expect(loaderPhase(1, 2)).toBeCloseTo(0.5);
    expect(loaderPhase(2, 2)).toBe(0);
    expect(loaderPhase(3, 2)).toBeCloseTo(0.5);
  });

  it('a negative begin pre-rolls rather than going negative', () => {
    // SMIL's negative `begin` starts an element partway through its first run.
    const p = loaderPhase(0, 2, -0.5);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeCloseTo(0.25);
  });

  it('sampleLinear walks evenly spaced keyframes and clamps its ends', () => {
    expect(sampleLinear([0, 10], 0.5)).toBeCloseTo(5);
    expect(sampleLinear([0, 10, 0], 0.25)).toBeCloseTo(5);
    expect(sampleLinear([4], 0.7)).toBe(4);
    expect(sampleLinear([0, 10], 2)).toBe(10);
  });

  it('a cubic-bezier easing hits both endpoints and stays monotonic', () => {
    const ease = cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBeCloseTo(0, 3);
    expect(ease(1)).toBeCloseTo(1, 3);
    let previous = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = ease(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});
