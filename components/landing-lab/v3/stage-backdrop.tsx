'use client';

import { type MotionValue, motion } from 'motion/react';

/**
 * The globe stage's ground, under the canvas: drifting clay-tone blobs
 * keep the cream daylight alive, and a warm-space layer — bright-center
 * espresso gradient, amber nebula glows, a halo lifting the sphere —
 * fades in with `darkness`, i.e. with how deep into night the faced
 * continent currently is.
 */
export function StageBackdrop({ darkness }: { darkness: MotionValue<number> }) {
  return (
    <div aria-hidden className="absolute inset-0">
      {/* Daylight ground: slow clay-tone blobs on cream. */}
      <motion.div
        animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0] }}
        transition={{
          duration: 26,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
        className="absolute top-[-12%] right-[-8%] h-[560px] w-[560px] rounded-full bg-[#E8D5B5]/35 blur-[110px]"
      />
      <motion.div
        animate={{ x: [0, -50, 40, 0], y: [0, 35, -25, 0] }}
        transition={{
          duration: 32,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
        className="absolute bottom-[-14%] left-[-10%] h-[520px] w-[520px] rounded-full bg-[#C9A87C]/25 blur-[100px]"
      />
      <motion.div
        animate={{ x: [0, 40, -40, 0] }}
        transition={{
          duration: 38,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
        className="absolute top-[30%] left-[22%] h-[380px] w-[380px] rounded-full bg-[#A9834E]/12 blur-[120px]"
      />

      {/* Night ground: warm espresso space whose opacity IS the faced
          continent's real darkness. */}
      <motion.div style={{ opacity: darkness }} className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 130% 105% at 50% 42%, #33291A 0%, #241C11 48%, #17110A 100%)',
          }}
        />
        <motion.div
          animate={{ x: [0, 70, -40, 0], y: [0, -30, 40, 0] }}
          transition={{
            duration: 34,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
          className="absolute top-[6%] right-[4%] h-[640px] w-[640px] rounded-full bg-[#C9A87C]/14 blur-[130px]"
        />
        <motion.div
          animate={{ x: [0, -60, 40, 0], y: [0, 45, -30, 0] }}
          transition={{
            duration: 42,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'easeInOut',
          }}
          className="absolute bottom-[2%] left-[2%] h-[580px] w-[580px] rounded-full bg-[#A9834E]/12 blur-[120px]"
        />
        {/* A faint halo behind the sphere lifts it off the deep field. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle 460px at 50% 52%, rgba(232,213,181,0.16), transparent 70%)',
          }}
        />
      </motion.div>
    </div>
  );
}
