'use client';

import Image from 'next/image';
import {
  formatCaloriesValue,
  formatMacroValue,
} from '@/components/logging/feed/format-inline-nutrition';
import { TimeDivider } from '@/components/logging/feed/time-divider';
import { type HeroMeal, mealTotals } from './logged-meals';

/**
 * The app's own logged-meal card, on the landing page — in its expanded state,
 * so the derivation is visible rather than implied.
 *
 * This mirrors `components/logging/feed/persisted/precise-meal-card.tsx` and
 * `meal-details.tsx`: same time divider, same card chrome, same serif raw-input
 * line, the same per-item rows with their macro triples, and the same totals
 * footer — reusing the real `TimeDivider` and the real number formatters so
 * everything is typeset exactly as it is in the product.
 *
 * What it drops is everything interactive: the collapse chevron, the amount
 * editor, the refine field and the action bar, which carry TanStack Query
 * mutations, dialogs and authenticated calls that have no business on a
 * marketing page. Showing an affordance that does nothing would be worse than
 * not showing it.
 */
export function LoggedMealCard({
  meal,
  dark,
  active,
  dimmed,
  onFocusMeal,
  onSelectMeal,
}: {
  meal: HeroMeal;
  dark: boolean;
  active: boolean;
  dimmed: boolean;
  onFocusMeal: () => void;
  onSelectMeal: () => void;
}) {
  const totals = mealTotals(meal);
  const muted = dark ? 'text-[#B8A88E]' : 'text-nham-text-muted';
  const strong = dark ? 'text-nham-surface' : 'text-nham-text';
  const hairline = dark ? 'border-white/10' : 'border-nham-border';

  return (
    // The time divider sits outside the button: it renders divs, and a div
    // inside a button is invalid markup that browsers reparent. The wrapper
    // carries hover, the button carries the click.
    <div
      onPointerEnter={onFocusMeal}
      onFocus={onFocusMeal}
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

      <button
        type="button"
        onClick={onSelectMeal}
        className={`relative isolate flex w-full flex-1 flex-col overflow-hidden rounded-2xl border p-4 text-left transition-shadow focus-visible:outline-none ${
          dark
            ? 'border-white/12 bg-[#241E15] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.85)]'
            : `border-nham-border/60 bg-white ${active ? 'shadow-md' : 'shadow-sm'}`
        }`}
      >
        {/* The meal's painting, revealed inside the card on hover. It sits
            below the content in the stacking context, under a veil in the
            card's own surface colour so the numbers stay readable on top. */}
        <Image
          src={dark ? meal.art.dark : meal.art.cream}
          alt=""
          fill
          sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
          style={{ opacity: active ? 1 : 0 }}
          className={`-z-10 object-cover transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            active ? 'scale-105' : 'scale-100'
          }`}
        />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            opacity: active ? 1 : 0,
            // Heaviest at the bottom, where the totals row sits; lightest at
            // the top, where the serif line has the paint mostly to itself.
            background: dark
              ? 'linear-gradient(to top, rgba(28,24,16,0.82) 0%, rgba(28,24,16,0.5) 55%, rgba(28,24,16,0.32) 100%)'
              : 'linear-gradient(to top, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.46) 55%, rgba(255,255,255,0.3) 100%)',
          }}
        />

        <span
          className={`block font-serif text-[15px] leading-relaxed ${strong}`}
        >
          {meal.rawInput}
        </span>

        <span className={`mt-4 block flex-1 border-t pt-3 ${hairline}`}>
          {meal.items.map((item) => (
            <span
              key={item.name}
              className="flex items-center justify-between gap-2 py-1.5 font-sans-display text-[12px]"
            >
              <span className={`min-w-0 truncate font-medium ${strong}`}>
                {item.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={`flex gap-1.5 text-[10px] tabular-nums ${muted}`}
                >
                  <span>P:{formatMacroValue(item.protein)}</span>
                  <span>C:{formatMacroValue(item.carbs)}</span>
                  <span>F:{formatMacroValue(item.fat)}</span>
                </span>
                <span className={`font-bold tabular-nums ${strong}`}>
                  {item.calories}
                </span>
              </span>
            </span>
          ))}
        </span>

        <span
          className={`mt-2 flex items-center justify-between gap-2 border-t pt-3 font-sans-display ${
            dark ? 'border-white/10' : 'border-nham-border/50'
          }`}
        >
          <span className={`text-[11px] tabular-nums ${muted}`}>
            P: {formatMacroValue(totals.protein)}
            {'  '}C: {formatMacroValue(totals.carbs)}
            {'  '}F: {formatMacroValue(totals.fat)}
          </span>
          <span className={`shrink-0 font-bold text-sm tabular-nums ${strong}`}>
            {formatCaloriesValue(totals.calories)}
          </span>
        </span>
      </button>
    </div>
  );
}
