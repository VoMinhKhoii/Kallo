'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { LoggedMealDetails } from './logged-meal-details';
import { type HeroMeal, mealTotals } from './logged-meals';

/**
 * How far the painting comes up.
 *
 * The plates are light, so the card stays light underneath them and the type
 * keeps its normal ink. That is the whole reason this reads better than the
 * dark set did — no inversion, no card turning into a dark tile mid-page.
 * Tune this one number if the art fights the text.
 *
 * It is on from the start rather than on hover. Hiding it meant a visitor who
 * never moved the pointer — every phone, and plenty of desktops — saw four
 * plain white boxes and never learned the art was there at all.
 */
const ART_OPACITY = 0.65;

/**
 * The app's logged-meal card, on the landing page.
 *
 * Mirrors `components/logging/feed/persisted/precise-meal-card.tsx` and
 * `meal-details.tsx`: the same card chrome and padding, the same serif
 * raw-input line at 17/19px, the same expand chevron, the same per-dish rows
 * with their macro triple and bold calories, and the same Total footer —
 * reusing the real number formatters so nothing is retyped by hand.
 *
 * Three deliberate differences. It opens expanded, because the derivation is
 * the thing worth showing on a landing page. The action bar is left off: it
 * carries TanStack Query mutations, share dialogs and authenticated calls that
 * have no business here, and a row of buttons that did nothing would be worse
 * than no row at all. And the time divider with its entry chip is gone too —
 * on a marketing page a timestamp is set dressing, and it was the only thing
 * above the card competing with the sentence.
 */
export function LoggedMealCard({
  meal,
  active,
  dimmed,
  offset,
  onFocusMeal,
  onLeaveMeal,
  onSelectMeal,
}: {
  meal: HeroMeal;
  active: boolean;
  dimmed: boolean;
  /** Drop this card a step on wide screens, so the ragged bottoms that come
      from meals having different numbers of items read as rhythm rather than
      as four boxes that failed to line up. */
  offset: boolean;
  onFocusMeal: () => void;
  onLeaveMeal: () => void;
  onSelectMeal: () => void;
}) {
  const t = useTranslations('landing.hero');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const totals = mealTotals(meal);

  return (
    // The time divider sits outside the card body, exactly as in the feed.
    // The wrapper carries hover for the artwork.
    <div
      onPointerEnter={onFocusMeal}
      onPointerLeave={onLeaveMeal}
      style={{ opacity: dimmed ? 0.5 : 1 }}
      className={`flex flex-col transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        active ? '-translate-y-2' : ''
      } ${offset ? 'lg:mt-12' : ''}`}
    >
      {/* The whole card is the control. It used to be two buttons — the
          sentence selected the meal, a 24px chevron collapsed it — which meant
          the obvious gesture, tapping the card, did nothing. One button also
          fixes the nested-interactive problem the old markup had; the chevron
          is now decoration inside it and carries no handler of its own. */}
      <button
        type="button"
        aria-expanded={!isCollapsed}
        aria-label={t('toggleDetails')}
        onClick={() => {
          onSelectMeal();
          setIsCollapsed((prev) => !prev);
        }}
        className="relative isolate flex w-full flex-col overflow-hidden rounded-2xl border border-nham-border/60 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      >
        <Image
          src={meal.art}
          alt=""
          fill
          sizes="(min-width: 1024px) 34rem, (min-width: 640px) 45vw, 90vw"
          style={{ opacity: ART_OPACITY }}
          className={`-z-10 object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            active ? 'scale-105' : 'scale-100'
          }`}
        />

        {/* Header */}
        <div className="flex w-full items-start justify-between gap-3">
          <span className="min-w-0 font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
            {t(`meals.${meal.id}.input`)}
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full p-1 text-nham-text"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </span>
        </div>

        {isCollapsed ? (
          <div className="mt-2 flex items-center justify-between font-sans-display">
            <span className="text-[11px] text-nham-text tabular-nums">
              P: {formatMacroValue(totals.protein)}
              {'  '}C: {formatMacroValue(totals.carbs)}
              {'  '}F: {formatMacroValue(totals.fat)}
            </span>
            <span className="font-bold text-nham-text text-sm tabular-nums">
              {formatCaloriesValue(totals.calories)}
            </span>
          </div>
        ) : (
          <LoggedMealDetails meal={meal} />
        )}
      </button>
    </div>
  );
}
