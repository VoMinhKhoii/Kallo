'use client';

import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { TimeDivider } from '@/components/logging/feed/time-divider';
import { type HeroMeal, mealTotals } from './logged-meals';

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
 * On hover the meal's own painting fills the card behind the type, dialled
 * back so the card's surface still sets the contrast.
 */
export function LoggedMealCard({
  meal,
  dark,
  active,
  dimmed,
  onFocusMeal,
  onLeaveMeal,
  onSelectMeal,
}: {
  meal: HeroMeal;
  dark: boolean;
  active: boolean;
  dimmed: boolean;
  onFocusMeal: () => void;
  onLeaveMeal: () => void;
  onSelectMeal: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const totals = mealTotals(meal);

  // Hovered, the type is always light: on cream the chiaroscuro painting runs
  // at full strength and turns the card dark, and on espresso the light
  // painting is held back far enough that the card stays dark. Two routes to
  // the same place, which is why nothing has to be laid over the text.
  const lightText = active ? true : dark;
  const strong = lightText ? 'text-nham-surface' : 'text-nham-text';
  const muted = active
    ? 'text-nham-surface/90'
    : dark
      ? 'text-[#B8A88E]'
      : 'text-nham-text-muted';
  const rule = lightText ? 'border-white/25' : 'border-nham-border';
  const ruleFaint = lightText ? 'border-white/20' : 'border-nham-border/50';

  // Espresso keeps its painting dim so the card never brightens under the
  // type; cream needs the opposite, because a dark painting held back leaves
  // only its darkest mass and you see the dish floating alone.
  const artOpacity = dark ? 0.34 : 0.92;

  return (
    // The time divider sits outside the card body, exactly as in the feed.
    // The wrapper carries hover for the artwork.
    <div
      onPointerEnter={onFocusMeal}
      onPointerLeave={onLeaveMeal}
      style={{ opacity: dimmed ? 0.5 : 1 }}
      className={`flex h-full flex-col transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        active ? '-translate-y-2' : ''
      }`}
    >
      <TimeDivider timeLabel={meal.timeLabel}>
        <span
          className={`rounded-full px-2 py-0.5 font-medium font-sans-display text-[10px] ${
            dark
              ? 'bg-white/10 text-nham-surface'
              : 'bg-nham-hover text-nham-text'
          }`}
        >
          {meal.entry}
        </span>
      </TimeDivider>

      <div
        className={`relative isolate flex flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${
          dark
            ? 'border-white/12 bg-[#241E15]'
            : 'border-nham-border/60 bg-white'
        }`}
      >
        <Image
          src={dark ? meal.art.cream : meal.art.dark}
          alt=""
          fill
          sizes="(min-width: 1024px) 34rem, (min-width: 640px) 45vw, 90vw"
          style={{ opacity: active ? artOpacity : 0 }}
          className={`-z-10 object-cover transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            active ? 'scale-105' : 'scale-100'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onSelectMeal}
            className={`min-w-0 text-left font-serif text-[17px] leading-relaxed sm:text-[19px] ${strong}`}
          >
            {meal.rawInput}
          </button>
          <button
            type="button"
            aria-label="Toggle details"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`shrink-0 rounded-full p-1 transition-colors ${
              dark
                ? 'text-nham-surface/50 hover:bg-white/10 hover:text-nham-surface'
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
            <span className={`text-[11px] tabular-nums ${muted}`}>
              P: {formatMacroValue(totals.protein)}
              {'  '}C: {formatMacroValue(totals.carbs)}
              {'  '}F: {formatMacroValue(totals.fat)}
            </span>
            <span className={`font-bold text-sm tabular-nums ${strong}`}>
              {formatCaloriesValue(totals.calories)}
            </span>
          </div>
        ) : (
          <div className={`mt-5 flex-1 border-t pt-4 ${rule}`}>
            <div className="mb-4 space-y-1">
              {meal.items.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between py-2 font-sans-display text-[13px]"
                >
                  <span className={`min-w-0 truncate font-medium ${strong}`}>
                    {item.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <div
                      className={`flex gap-2 text-[10px] tabular-nums ${muted}`}
                    >
                      <span className="text-right">
                        P:{formatMacroValue(item.protein)}
                      </span>
                      <span className="text-right">
                        C:{formatMacroValue(item.carbs)}
                      </span>
                      <span className="text-right">
                        F:{formatMacroValue(item.fat)}
                      </span>
                    </div>
                    <span
                      className={`text-right font-bold tabular-nums ${strong}`}
                    >
                      {formatCaloriesValue(item.calories)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`border-t pt-3 ${ruleFaint}`}>
              <div className="flex items-center justify-between">
                <span
                  className={`font-bold font-sans-display text-[13px] ${strong}`}
                >
                  Total
                </span>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-sans-display text-[11px] tabular-nums ${muted}`}
                  >
                    P: {formatMacroValue(totals.protein)}
                    {'  '}C: {formatMacroValue(totals.carbs)}
                    {'  '}F: {formatMacroValue(totals.fat)}
                  </span>
                  <span
                    className={`font-bold font-sans-display tabular-nums ${strong}`}
                  >
                    {formatCaloriesValue(totals.calories)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
