'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import type { Plate } from './plates';

/**
 * A full-bleed generated artwork, breathing.
 *
 * The drift is deliberately near-imperceptible — a 90s cycle you notice only
 * by looking away and back. It's what keeps a still painting from reading as a
 * static JPEG without ever competing with the copy on top. Transform and
 * opacity only; the base scale covers the rotation so no edge ever shows.
 */
export function ArtPlate({
  plate,
  priority = false,
}: {
  plate: Plate;
  priority?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        mixBlendMode: plate.blend,
        opacity: plate.opacity,
        willChange: reduced ? undefined : 'transform',
      }}
      animate={
        reduced
          ? { scale: 1.08 }
          : { scale: [1.08, 1.15, 1.08], rotate: [0, 1.1, 0], x: [0, -18, 0] }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              duration: 90,
              repeat: Number.POSITIVE_INFINITY,
              ease: [0.45, 0, 0.55, 1],
            }
      }
    >
      <Image
        src={plate.src}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
    </motion.div>
  );
}
