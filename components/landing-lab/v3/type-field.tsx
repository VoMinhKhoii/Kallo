'use client';

import {
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { useEffect } from 'react';
import type { LabMood } from '../use-demo';

/**
 * v3's signature: the world's dishes as a depth-layered field of Lora
 * italic type. Three parallax layers drift with cursor and scroll; when
 * a derivation runs, the words pull toward the command bar and dim —
 * language converging into a number.
 *
 * Positions are hardcoded (no runtime randomness → no SSR mismatch) and
 * ring the edges so the centered copy always sits on clear cream.
 */

interface Word {
  text: string;
  /** Viewport-percentage position. */
  x: number;
  y: number;
  size: string;
  /** Only a handful of words survive on small screens. */
  mobile?: boolean;
}

interface Layer {
  depth: number;
  className: string;
  words: Word[];
}

const LAYERS: Layer[] = [
  {
    // Far: small, pale, softly blurred.
    depth: 0.35,
    className: 'text-[#E8D5B5] opacity-60 blur-[1.5px]',
    words: [
      { text: 'carbonara', x: 8, y: 14, size: '1.4rem' },
      { text: 'jollof rice', x: 78, y: 10, size: '1.3rem' },
      { text: 'bibimbap', x: 88, y: 38, size: '1.5rem' },
      { text: 'pierogi', x: 5, y: 55, size: '1.3rem' },
      { text: 'moussaka', x: 82, y: 78, size: '1.4rem' },
      { text: 'shakshuka', x: 14, y: 86, size: '1.3rem' },
    ],
  },
  {
    depth: 0.65,
    className: 'text-[#DFC9A6] opacity-70 blur-[0.5px]',
    words: [
      { text: 'tikka masala', x: 12, y: 30, size: '2rem', mobile: true },
      { text: 'tacos al pastor', x: 72, y: 22, size: '1.8rem' },
      { text: 'canh chua', x: 84, y: 58, size: '1.9rem', mobile: true },
      { text: 'pad thai', x: 8, y: 70, size: '1.8rem' },
      { text: 'ramen', x: 68, y: 88, size: '2rem', mobile: true },
    ],
  },
  {
    // Near: larger, warmer, sharp.
    depth: 1,
    className: 'text-[#C9A87C] opacity-75',
    words: [
      { text: 'phở bò', x: 16, y: 12, size: '3rem', mobile: true },
      { text: 'bún chả', x: 76, y: 42, size: '2.6rem' },
      { text: 'mực kho', x: 10, y: 46, size: '2.4rem' },
      { text: 'avocado toast', x: 62, y: 8, size: '2.2rem' },
      { text: 'bánh mì', x: 80, y: 90, size: '2.8rem', mobile: true },
      { text: 'cơm tấm', x: 20, y: 92, size: '2.4rem' },
    ],
  },
];

function ParallaxLayer({
  layer,
  mood,
  pointerX,
  pointerY,
  scrollY,
  reduced,
}: {
  layer: Layer;
  mood: LabMood;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  scrollY: MotionValue<number>;
  reduced: boolean;
}) {
  // With reduced motion the parallax factor collapses to zero — the same
  // style shape is always rendered, so SSR and client HTML agree.
  const factor = reduced ? 0 : layer.depth;
  const x = useTransform(pointerX, (value) => value * factor * 26);
  const y = useTransform(
    [pointerY, scrollY],
    ([pointer, scroll]: number[]) =>
      pointer * factor * 18 - scroll * factor * 0.08
  );
  const converge = mood === 'analyzing';

  return (
    <motion.div style={{ x, y }} className="absolute inset-0">
      {layer.words.map((word, index) => (
        <motion.span
          key={word.text}
          animate={{
            opacity: converge ? (reduced ? 0.25 : 0.12) : 1,
            x: converge && !reduced ? (50 - word.x) * 3.2 : 0,
            y: converge && !reduced ? (46 - word.y) * 2.4 : 0,
            scale: converge && !reduced ? 0.9 : 1,
          }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
          className={`absolute font-light font-serif italic ${layer.className} ${
            word.mobile ? '' : 'hidden md:inline-block'
          }`}
          style={{
            left: `${word.x}%`,
            top: `${word.y}%`,
            fontSize: word.size,
          }}
        >
          <motion.span
            animate={{ y: [0, -10, 0] }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    duration: 6 + index * 1.3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }
            }
            className="inline-block"
          >
            {word.text}
          </motion.span>
        </motion.span>
      ))}
    </motion.div>
  );
}

export function TypeField({ mood }: { mood: LabMood }) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 50, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 50, damping: 20 });
  const { scrollY } = useScroll();

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [pointerX, pointerY, prefersReducedMotion]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {LAYERS.map((layer) => (
        <ParallaxLayer
          key={layer.depth}
          layer={layer}
          mood={mood}
          pointerX={springX}
          pointerY={springY}
          scrollY={scrollY}
          reduced={prefersReducedMotion}
        />
      ))}
      {/* Feather the field toward the center column. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 58% 52% at 50% 46%, rgba(254,251,246,0.9), rgba(254,251,246,0.35) 60%, transparent 85%)',
        }}
      />
    </div>
  );
}
