'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { TimeDivider } from '@/components/logging/feed/time-divider';
import { LoggedMealDetails } from './logged-meal-details';
import { type HeroMeal, mealTotals } from './logged-meals';
import { cardInk } from './tone';

/**
 * The app's logged-meal card, on the landing page.
 *
 * Mirrors `components/logging/feed/persisted/precise-meal-card.tsx` and
 * `meal-details.tsx` element for element: the same time divider, card chrome
 * and padding, the same serif raw-input line at 17/19px, the same expand
 * chevron, the same per-dish rows with their macro triple and bold calories,
 * and the same Total footer — reusing the real `TimeDivider` and the real
 * number formatters so nothing is retyped by hand.
 *
 * Two deliberate differences. It opens expanded, because the derivation is the
 * thing worth showing on a landing page. And the action bar is left off: it
 * carries TanStack Query mutations, share dialogs and authenticated calls that
 * have no business here, and a row of buttons that did nothing would be worse
 * than no row at all.
 *
 * On hover the meal's own painting fills the card behind the type and the ink
 * flips light to meet it.
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
  const ink = cardInk(active);

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
      <TimeDivider timeLabel={meal.timeLabel}>
        <span className="rounded-full bg-nham-hover px-2 py-0.5 font-medium font-sans-display text-[10px] text-nham-text">
          {t(`entry.${meal.entry}`)}
        </span>
      </TimeDivider>

      <div className="relative isolate flex flex-col overflow-hidden rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <Image
          src={meal.art}
          alt=""
          fill
          sizes="(min-width: 1024px) 34rem, (min-width: 640px) 45vw, 90vw"
          // Near-full strength: dark paint over white subtracts rather than
          // glows, so holding it back leaves only the darkest mass — the dish
          // floating alone on a pale card.
          style={{ opacity: active ? 0.92 : 0 }}
          className={`-z-10 object-cover transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            active ? 'scale-105' : 'scale-100'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onSelectMeal}
            className={`min-w-0 text-left font-serif text-[17px] leading-relaxed sm:text-[19px] ${ink.strong}`}
          >
            {t(`meals.${meal.id}.input`)}
          </button>
          <button
            type="button"
            aria-label={t('toggleDetails')}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`shrink-0 rounded-full p-1 transition-colors ${
              active
                ? 'text-nham-surface/70 hover:bg-white/10 hover:text-nham-surface'
                : 'text-nham-text-muted/60 hover:bg-nham-hover/40 hover:text-nham-text'
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {isCollapsed ? (
          <div className="mt-2 flex items-center justify-between font-sans-display">
            <span className={`text-[11px] tabular-nums ${ink.muted}`}>
              P: {formatMacroValue(totals.protein)}
              {'  '}C: {formatMacroValue(totals.carbs)}
              {'  '}F: {formatMacroValue(totals.fat)}
            </span>
            <span className={`font-bold text-sm tabular-nums ${ink.strong}`}>
              {formatCaloriesValue(totals.calories)}
            </span>
          </div>
        ) : (
          <LoggedMealDetails meal={meal} ink={ink} />
        )}
      </div>
    </div>
  );
}
