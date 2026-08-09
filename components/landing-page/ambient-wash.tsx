'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Slow beige drift, so the page is never quite still.
 *
 * Three radial gradients rather than blurred divs: same softness, none of the
 * repaint cost of a large `filter: blur()`. Only `transform` is animated.
 */
const WASHES = [
  {
    id: 'tan',
    tint: '201,168,124',
    size: '46rem',
    top: '-14%',
    left: '-8%',
    seconds: 54,
    dx: 80,
    dy: 50,
  },
  {
    id: 'clay',
    tint: '139,115,85',
    size: '38rem',
    top: '46%',
    left: '64%',
    seconds: 69,
    dx: -90,
    dy: -60,
  },
  {
    id: 'stone',
    tint: '168,162,158',
    size: '34rem',
    top: '68%',
    left: '10%',
    seconds: 81,
    dx: 70,
    dy: -45,
  },
];

/**
 * The page's ambient ground, behind every section.
 *
 * Fixed rather than absolute, and mounted once at the page root rather than
 * per section. Fixed means the drift keeps running the whole way down instead
 * of being a thing that happens in the hero and then stops, and it costs three
 * elements for the entire page rather than three per section.
 *
 * The sections above this are transparent; the cream comes from `body`. A
 * section painting its own `bg-nham-surface` would cover this entirely.
 *
 * The veil is what keeps type legible over the blobs — it pulls the middle of
 * the viewport back toward paper and lets the colour survive only at the
 * edges.
 */
export function AmbientWash() {
  const reduced = useReducedMotion() ?? false;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {WASHES.map((wash) => (
        <motion.div
          key={wash.id}
          className="absolute"
          style={{
            width: wash.size,
            height: wash.size,
            top: wash.top,
            left: wash.left,
            background: `radial-gradient(closest-side, rgba(${wash.tint},0.26), rgba(${wash.tint},0) 72%)`,
          }}
          animate={
            reduced ? undefined : { x: [0, wash.dx, 0], y: [0, wash.dy, 0] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: wash.seconds,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: [0.45, 0, 0.55, 1],
                }
          }
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(72% 62% at 50% 44%, rgba(249,249,247,0.92) 0%, rgba(249,249,247,0.66) 46%, rgba(249,249,247,0) 82%)',
        }}
      />
    </div>
  );
}
