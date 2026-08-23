'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { HeroHeadline } from './headline';
import { LoggedMealCard } from './logged-meal-card';
import { HERO_MEALS } from './logged-meals';
import { HERO_EASE, HERO_GROUND } from './tone';
import { WaitlistPill } from './waitlist-pill';

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
export function MealCardHero() {
  const t = useTranslations('landing.hero');
  const reduced = useReducedMotion() ?? false;
  const [activeId, setActiveId] = useState<string | null>(null);

  // A phone has no hover, so every card wears its painting and nothing dims.
  //
  // `(hover: none)` alone does not detect that. Chrome reports `hover: hover`
  // in responsive mode at any viewport, and some Android browsers report it on
  // real hardware, so the art stayed hidden exactly where it was needed. The
  // width clause is the honest backstop: below md the cards are full-width and
  // there is nothing to hover between anyway.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(
      '(hover: none), (pointer: coarse), (max-width: 767px)'
    );
    const sync = () => setTouch(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

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
      aria-labelledby="landing-headline"
      className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden"
      onPointerLeave={() => setActiveId(null)}
    >
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col items-center justify-center px-4 pt-24 pb-10 text-center sm:px-6">
        {/* On a phone the promise owns the first screen; the cards are what
            scrolling is for. On lg everything sits in one viewport again. */}
        <div className="flex min-h-[calc(100dvh-13rem)] flex-col items-center justify-center md:min-h-0">
          <motion.div {...rise(0)}>
            <HeroHeadline ink={HERO_GROUND.ink} />
          </motion.div>

          <motion.p
            {...rise(1)}
            className={`mt-5 max-w-2xl text-pretty text-base leading-[1.6] ${HERO_GROUND.body}`}
          >
            {t('subtitle')}
          </motion.p>

          <motion.div {...rise(2)} className="mt-8 w-full">
            <WaitlistPill />
          </motion.div>
        </div>

        {/* A section, not a div: the four cards are the page's second real block
            of content and had no heading at all, so the document went h1 →
            (nothing) → h3 and neither a screen reader nor a crawler could tell
            where the hero ended. The heading is visually hidden because the
            cards are self-explanatory to anyone who can see them. */}
        <motion.section
          {...rise(3)}
          aria-labelledby="landing-examples"
          className="mx-auto mt-10 grid w-full max-w-[100rem] grid-cols-1 items-start gap-x-5 gap-y-8 sm:grid-cols-2 md:mt-12 lg:grid-cols-4"
        >
          <h2 className="sr-only" id="landing-examples">
            {t('examplesHeading')}
          </h2>
          {HERO_MEALS.map((meal, index) => (
            <LoggedMealCard
              key={meal.id}
              offset={index % 2 === 1}
              meal={meal}
              active={touch || activeId === meal.id}
              dimmed={!touch && activeId !== null && activeId !== meal.id}
              onFocusMeal={() => setActiveId(meal.id)}
              onLeaveMeal={() => setActiveId(null)}
              onSelectMeal={() => setActiveId(meal.id)}
            />
          ))}
        </motion.section>

        <motion.div
          {...rise(4)}
          className={`mt-7 space-y-1 text-xs ${HERO_GROUND.body}`}
        >
          {/* The desktop hint invites a hover. On touch the paintings are
              already up, so inviting one would be a lie. */}
          <p>{t(touch ? 'cardsHintTouch' : 'cardsHint')}</p>
          <p>{t('beta')}</p>
        </motion.div>
      </div>
    </section>
  );
}
