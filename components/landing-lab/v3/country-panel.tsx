'use client';

import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { LAB_COPY } from '../copy';
import { GLOBE_COUNTRIES } from './globe-dishes';

/**
 * The DOM half of the cuisine globe: a card that crossfades to whichever
 * country is under the cursor. Fixed minimum height so hover churn never
 * shifts the layout; aria-live so the reveal is announced.
 */
export function CountryPanel({ iso }: { iso: string | null }) {
  const country = iso ? GLOBE_COUNTRIES[iso] : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[300px] w-full max-w-md rounded-3xl border border-[#E8D5B5] bg-white/90 p-6 shadow-[0_18px_50px_-24px_rgba(107,93,79,0.35)] backdrop-blur-sm sm:p-7"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={iso ?? 'idle'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
        >
          {iso === null ? (
            <IdleHint />
          ) : country ? (
            <FeaturedCountry country={country} />
          ) : (
            <GenericCountry />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function IdleHint() {
  return (
    <div className="flex min-h-[240px] flex-col items-start justify-center gap-3">
      <Sparkles className="h-5 w-5 text-[#C9A87C]" />
      <p className="font-light font-serif text-[#2C2416] text-xl leading-snug">
        <span className="[@media(hover:none)]:hidden">
          {LAB_COPY.globe.hint}
        </span>
        <span className="[@media(hover:hover)]:hidden">
          {LAB_COPY.globe.hintTouch}
        </span>
      </p>
      <p className="font-sans-display text-[#8B7355] text-sm">
        {LAB_COPY.globe.hintSub}
      </p>
    </div>
  );
}

function FeaturedCountry({
  country,
}: {
  country: (typeof GLOBE_COUNTRIES)[string];
}) {
  return (
    <div>
      <h3 className="mb-4 font-normal font-serif text-2xl text-[#2C2416] tracking-[-0.01em]">
        {country.name}
      </h3>
      <ul className="flex flex-col gap-4">
        {country.dishes.map((dish) => (
          <li key={dish.name}>
            <p className="font-medium font-sans-display text-[#2C2416] text-sm">
              {dish.name}
            </p>
            <p className="mt-0.5 font-light font-sans-display text-[#6B5D4F] text-sm leading-relaxed">
              {dish.description}
            </p>
            <p className="mt-0.5 font-sans-display text-[#8B7355] text-xs italic">
              {dish.adjustments}
            </p>
          </li>
        ))}
      </ul>
      {country.dishes[0] && (
        <div className="mt-5 border-[#F0EAE0] border-t pt-4">
          <p className="mb-2 font-medium text-[#8B7355] text-[11px] uppercase tracking-[0.16em]">
            {LAB_COPY.globe.chipCaption}
          </p>
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E8D5B5] bg-white px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C9A87C]" />
            <span className="font-sans-display text-[#2C2416] text-sm">
              {country.dishes[0].logExample}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function GenericCountry() {
  return (
    <div className="flex min-h-[240px] flex-col items-start justify-center gap-3">
      <h3 className="font-normal font-serif text-2xl text-[#2C2416]">
        {LAB_COPY.globe.genericTitle}
      </h3>
      <p className="font-light font-sans-display text-[#6B5D4F] text-sm leading-relaxed">
        {LAB_COPY.globe.genericBody}
      </p>
    </div>
  );
}
