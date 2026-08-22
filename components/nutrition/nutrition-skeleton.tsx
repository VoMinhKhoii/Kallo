'use client';

import { useTranslations } from 'next-intl';

/**
 * Mirrors the live lean layout: the range-toggle header, the calorie/macro
 * summary card, and the two-column nutrient grid. Widths match
 * `nutrition-shell.tsx` so the page does not jump when data arrives.
 */
export function NutritionSkeleton() {
  const t = useTranslations('nutrition');

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {/* Fixed header region — mirrors the loaded shell's pinned header */}
      <div className="shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-3 w-full max-w-2xl">
          <div className="flex items-center justify-between motion-safe:animate-pulse">
            <div className="h-[18px] w-24 rounded-full bg-kallo-track" />
            <div className="h-8 w-36 rounded-full bg-kallo-track" />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 sm:px-6 lg:px-8">
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label={t('loading')}
          className="mx-auto flex max-w-2xl flex-col gap-7 motion-safe:animate-pulse"
        >
          {/* Summary card — calorie hero + composition bar + legend */}
          <div className="rounded-[1.375rem] bg-card p-5 shadow-[0_10px_32px_rgba(44,36,22,0.05)]">
            <div className="flex items-start justify-between">
              <div className="h-10 w-40 rounded-full bg-kallo-track" />
              <div className="h-3 w-20 rounded-full bg-kallo-track" />
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-kallo-track" />
            <div className="mt-3 flex justify-center gap-5">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="h-3 w-16 rounded-full bg-kallo-track"
                />
              ))}
            </div>
          </div>

          {/* Nutrient grid — two groups of 2-column cards */}
          {[0, 1].map((group) => (
            <div key={group} className="flex flex-col gap-3">
              <div className="h-3 w-24 rounded-full bg-kallo-track" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-2xl border border-kallo-border/60 bg-card p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-16 rounded-full bg-kallo-track" />
                      <div className="h-3 w-8 rounded-full bg-kallo-track" />
                    </div>
                    <div className="h-1 rounded-full bg-kallo-track" />
                    <div className="h-3 w-20 rounded-full bg-kallo-track" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
