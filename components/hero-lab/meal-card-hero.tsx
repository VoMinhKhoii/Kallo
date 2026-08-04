'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { WaitlistForm } from '@/components/landing-page/waitlist/waitlist-form';
import { HERO_COPY } from './copy';
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
 * The meal-card hero: the app's real logged-meal cards, each holding a
 * painting of its own meal.
 *
 * At rest the cards are exactly what the logging feed shows — a sentence, a
 * time, the derived rows, a calorie total — on plain card stock. Hovering one
 * brings that meal's painting up inside the card and dims its neighbours. The
 * page itself stays put; the change is local to the card you're looking at.
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

        <div className="absolute inset-0" style={{ background: t.veil }} />
      </div>

      <div
        className={`mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 pt-20 text-center sm:px-6 ${
          insetBottom ? 'pb-24' : 'pb-10'
        }`}
      >
        <motion.h1
          {...rise(0)}
          className={`font-bold font-serif text-[clamp(2.375rem,5.4vw,4rem)] leading-[1.03] tracking-[-0.03em] ${t.ink}`}
        >
          {HERO_COPY.title}
          <br />
          <span className={`font-light italic ${t.headlineSoft}`}>
            {HERO_COPY.titleHighlight}
          </span>
        </motion.h1>

        <motion.p
          {...rise(1)}
          className={`mt-5 max-w-2xl text-pretty text-base leading-[1.6] ${t.body}`}
        >
          {HERO_COPY.subtitle}
        </motion.p>

        <motion.div {...rise(2)} className="mt-8 w-full max-w-xl">
          <WaitlistForm />
        </motion.div>

        <motion.div
          {...rise(3)}
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
              onSelectMeal={() => setActiveId(meal.id)}
            />
          ))}
        </motion.div>

        <motion.div
          {...rise(4)}
          className={`mt-7 space-y-1 text-xs ${t.faint}`}
        >
          <p>{HERO_COPY.cardsHint}</p>
          <p>{HERO_COPY.beta}</p>
        </motion.div>
      </div>
    </section>
  );
}
