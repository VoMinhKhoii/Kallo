'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CommandBar } from '@/components/landing-lab/command-bar';
import { LAB_COPY } from '@/components/landing-lab/copy';
import { useLabDemo } from '@/hooks/landing-lab/use-demo';
import { LoggedMealCard } from './logged-meal-card';
import { HERO_MEALS } from './logged-meals';
import { HERO_EASE, HERO_TONE, type HeroTone } from './tone';

/** Two slow washes so the page still breathes with nothing hovered. */
const RESTING = [
  {
    tint: '201,168,124',
    size: '46rem',
    top: '-14%',
    left: '-8%',
    seconds: 54,
    dx: 80,
    dy: 50,
  },
  {
    tint: '139,115,85',
    size: '38rem',
    top: '46%',
    left: '64%',
    seconds: 69,
    dx: -90,
    dy: -60,
  },
];

/**
 * The meal-card hero: the app's real logged-meal cards, and the room behind
 * them changing.
 *
 * At rest the page is quiet and the cards are exactly what the logging feed
 * shows — a sentence, a time, a macro line, a calorie total. Hovering one
 * floods the whole page with a painting of that meal. Nothing decorative
 * appears until you ask for it.
 *
 * The four meals are chosen to answer both halves of the audience in one
 * glance: two eyeballed in plain language, two weighed to the gram.
 */
export function MealCardHero({
  tone,
  insetBottom = false,
}: {
  tone: HeroTone;
  /** Reserve room under the copy for the lab's switch bar. */
  insetBottom?: boolean;
}) {
  const demo = useLabDemo();
  const reduced = useReducedMotion() ?? false;
  const [activeId, setActiveId] = useState<string | null>(null);
  const t = HERO_TONE[tone];
  const dark = tone === 'espresso';

  // No hover on touch, so the row takes itself through the set. The payoff has
  // to exist on a phone too, or it isn't a real design.
  useEffect(() => {
    const coarse = window.matchMedia('(hover: none)');
    if (!coarse.matches || reduced) {
      return;
    }
    let index = 0;
    setActiveId(HERO_MEALS[0].id);
    const timer = setInterval(() => {
      index = (index + 1) % HERO_MEALS.length;
      setActiveId(HERO_MEALS[index].id);
    }, 4000);
    return () => clearInterval(timer);
  }, [reduced]);

  const rise = (index: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.85, delay: index * 0.09, ease: HERO_EASE },
        };

  return (
    <section
      className={`relative isolate flex min-h-[100dvh] flex-col overflow-hidden ${t.ground}`}
      onPointerLeave={() => setActiveId(null)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {RESTING.map((wash) => (
          <motion.div
            key={wash.left}
            className="absolute"
            style={{
              width: wash.size,
              height: wash.size,
              top: wash.top,
              left: wash.left,
              background: `radial-gradient(closest-side, rgba(${wash.tint},0.28), rgba(${wash.tint},0) 72%)`,
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

        {HERO_MEALS.map((meal) => (
          <motion.div
            key={meal.id}
            className="absolute inset-0"
            style={{ mixBlendMode: dark ? 'screen' : 'multiply' }}
            initial={false}
            animate={{
              opacity: activeId === meal.id ? (dark ? 0.72 : 0.6) : 0,
              scale: activeId === meal.id ? 1 : 1.07,
            }}
            transition={{ duration: reduced ? 0 : 0.9, ease: HERO_EASE }}
          >
            <Image
              src={dark ? meal.art.dark : meal.art.cream}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
        ))}

        <div className="absolute inset-0" style={{ background: t.veil }} />
      </div>

      <div
        className={`mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-20 text-center sm:px-6 ${
          insetBottom ? 'pb-24' : 'pb-10'
        }`}
      >
        <motion.span
          {...rise(0)}
          className={`eyebrow inline-flex items-center rounded-full border px-3 py-1 ${t.eyebrowShell} ${t.eyebrowText}`}
        >
          {LAB_COPY.badge}
        </motion.span>

        <motion.h1
          {...rise(1)}
          className={`mt-6 font-serif text-[clamp(2.375rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.03em] ${t.ink}`}
        >
          {LAB_COPY.title}
          <br />
          <span className="italic-accent">{LAB_COPY.titleHighlight}</span>
        </motion.h1>

        <motion.p
          {...rise(2)}
          className={`mt-5 max-w-2xl text-pretty text-base leading-[1.6] ${t.body}`}
        >
          {LAB_COPY.subtitle}
        </motion.p>

        <motion.div {...rise(3)} className="mt-8 w-full max-w-2xl">
          <CommandBar demo={demo} tone={dark ? 'dark' : 'light'} />
        </motion.div>

        <motion.div
          {...rise(4)}
          className="mt-9 grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {HERO_MEALS.map((meal) => (
            <LoggedMealCard
              key={meal.id}
              meal={meal}
              dark={dark}
              active={activeId === meal.id}
              dimmed={activeId !== null && activeId !== meal.id}
              onFocusMeal={() => setActiveId(meal.id)}
              onSelectMeal={() => {
                setActiveId(meal.id);
                demo.submitText(meal.rawInput);
              }}
            />
          ))}
        </motion.div>

        <motion.div
          {...rise(5)}
          className={`mt-7 space-y-1 text-xs ${t.faint}`}
        >
          <p>
            Eyeballed or weighed to the gram — both go in the same way. Hover a
            meal to see it.
          </p>
          <p>{LAB_COPY.beta}</p>
        </motion.div>
      </div>
    </section>
  );
}
