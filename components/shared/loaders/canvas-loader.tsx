'use client';

import { useEffect, useRef } from 'react';
import type { LoaderSpec } from '@/lib/core/ui/loaders/loader-math';

/**
 * Where the clock rests when the user asks for reduced motion.
 *
 * NOT frame zero. Several loaders are mid-gesture by design and start empty —
 * the ECG trace has drawn nothing at t=0, the drip has not fallen — so pinning
 * to zero would show a reduced-motion user a blank box. A small offset lands
 * every loader somewhere legible.
 */
const RESTING_SECONDS = 0.95;

interface CanvasLoaderProps {
  spec: LoaderSpec;
  /** Rendered square size in px; wide loaders scale off this (see LoaderSpec). */
  size?: number;
  className?: string;
}

/**
 * Draws a [LoaderSpec] onto a canvas from a monotonic seconds clock.
 *
 * A raw rAF clock rather than a CSS or SMIL animation because these loaders
 * have PER-ELEMENT durations (audio alone runs four bars at 4.3s / 2s / 1.4s /
 * 2s) and negative pre-rolls. One shared 0→1 timeline would need their lowest
 * common multiple as its period and would wrap visibly; a monotonic seconds
 * clock is what SMIL actually models, and what the Flutter port uses too.
 *
 * Decorative by construction: `aria-hidden`, so it never speaks over the
 * live-region status label it is paired with.
 */
export function CanvasLoader({
  spec,
  size = 20,
  className,
}: CanvasLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = size * (spec.widthFactor ?? 1);
  const height = size * (spec.heightFactor ?? 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // The painters are handed a resolved colour: canvas has no `currentColor`,
    // so the inherited text colour is read off the element itself.
    const color = getComputedStyle(canvas).color;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const draw = (seconds: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      spec.paint(ctx, { width, height }, seconds, color);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) {
      // Hold one still frame instead of animating.
      draw(RESTING_SECONDS);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const frame = (now: number) => {
      start ??= now;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spec, width, height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width, height }}
    />
  );
}
