'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ArtPlate } from './art-plate';
import type { Plate } from './plates';
import type { HeroTone } from './tone';

interface Wash {
  tint: string;
  alpha: number;
  size: string;
  top: string;
  left: string;
  seconds: number;
  dx: number;
  dy: number;
  peak: number;
}

/**
 * Soft colour washes drifting under the plate. Radial gradients rather than
 * `filter: blur()` on a large div — same softness, none of the continuous GPU
 * repaint cost that a blurred full-screen layer carries on mobile.
 */
const WASHES: Record<Extract<HeroTone, 'cream' | 'espresso'>, Wash[]> = {
  cream: [
    {
      tint: '201,168,124',
      alpha: 0.34,
      size: '46rem',
      top: '-14%',
      left: '-8%',
      seconds: 46,
      dx: 90,
      dy: 60,
      peak: 1.16,
    },
    {
      tint: '139,115,85',
      alpha: 0.24,
      size: '40rem',
      top: '26%',
      left: '56%',
      seconds: 59,
      dx: -110,
      dy: -70,
      peak: 1.22,
    },
    {
      tint: '211,123,105',
      alpha: 0.16,
      size: '34rem',
      top: '58%',
      left: '14%',
      seconds: 71,
      dx: 70,
      dy: -90,
      peak: 1.12,
    },
  ],
  espresso: [
    {
      tint: '201,168,124',
      alpha: 0.26,
      size: '48rem',
      top: '-16%',
      left: '-6%',
      seconds: 46,
      dx: 90,
      dy: 60,
      peak: 1.16,
    },
    {
      tint: '211,123,105',
      alpha: 0.18,
      size: '38rem',
      top: '30%',
      left: '58%',
      seconds: 59,
      dx: -110,
      dy: -70,
      peak: 1.22,
    },
    {
      tint: '124,163,104',
      alpha: 0.1,
      size: '34rem',
      top: '60%',
      left: '16%',
      seconds: 71,
      dx: 70,
      dy: -90,
      peak: 1.12,
    },
  ],
};

/**
 * Direction A's ground: three slow colour washes with the artwork breathing on
 * top of them. The calmest of the three directions — motion you feel rather
 * than watch.
 */
export function ChromaticField({
  tone,
  plate,
}: {
  tone: Extract<HeroTone, 'cream' | 'espresso'>;
  plate: Plate;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <>
      {WASHES[tone].map((wash) => (
        <motion.div
          key={`${wash.top}-${wash.left}`}
          className="absolute"
          style={{
            width: wash.size,
            height: wash.size,
            top: wash.top,
            left: wash.left,
            background: `radial-gradient(closest-side, rgba(${wash.tint},${wash.alpha}), rgba(${wash.tint},0) 72%)`,
            willChange: reduced ? undefined : 'transform',
          }}
          animate={
            reduced
              ? undefined
              : {
                  x: [0, wash.dx, 0],
                  y: [0, wash.dy, 0],
                  scale: [1, wash.peak, 1],
                }
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
      <ArtPlate plate={plate} priority />
    </>
  );
}
