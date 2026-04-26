'use client';

import { useTranslations } from 'next-intl';

/**
 * Mirrors the live shell layout: editorial header, spotlight + rhythm split,
 * steady two-column block, background toggle row, and a pull-quote stripe.
 * Layout widths intentionally match `nutrition-shell.tsx` so the page does
 * not jump when data arrives.
 */
export function NutritionSkeleton() {
  const t = useTranslations('nutrition');

  return (
    <main className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
      <div
        role="status"
        aria-live="polite"
        aria-label={t('loading')}
        className="flex flex-col gap-12 motion-safe:animate-pulse"
      >
        {/* Editorial header */}
        <div className="space-y-3 border-nham-border/50 border-b pb-5">
          <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="space-y-2 lg:row-start-1">
              <div className="h-3 w-32 rounded-full bg-nham-track" />
              <div className="h-3 w-44 rounded-full bg-nham-track" />
            </div>
            <div className="hidden h-3 w-3/4 rounded-full bg-nham-track lg:block lg:px-6" />
            <div className="h-8 w-36 justify-self-end rounded-full bg-nham-track lg:row-start-1" />
            <div className="col-span-full h-3 w-3/4 rounded-full bg-nham-track lg:hidden" />
          </div>
        </div>

        {/* Daily rhythm + focus */}
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-5 rounded-3xl border border-nham-border/50 bg-card/40 p-6 lg:col-span-6 xl:col-span-7">
            <div className="flex items-end justify-between">
              <div className="h-10 w-32 rounded-full bg-nham-track" />
              <div className="h-2 w-32 rounded-full bg-nham-track" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[6rem_1fr_5rem] items-center gap-3"
                >
                  <div className="h-3 w-16 rounded-full bg-nham-track" />
                  <div className="h-1 rounded-full bg-nham-track" />
                  <div className="h-3 w-12 rounded-full bg-nham-track" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-6 xl:col-span-5">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <div className="h-6 w-32 rounded-full bg-nham-track" />
                  <div className="h-3 w-16 rounded-full bg-nham-track" />
                </div>
                <div className="h-1 rounded-full bg-nham-track" />
                <div className="flex gap-2">
                  {Array.from({ length: 4 }, (_, chip) => (
                    <div
                      key={chip}
                      className="h-7 w-20 rounded-full bg-nham-track"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Steady — two columns */}
        <div className="overflow-hidden rounded-2xl border border-nham-border/50 bg-card/40">
          <div className="grid sm:grid-cols-2">
            {[0, 1].map((col) => (
              <div
                key={col}
                className={
                  col === 1 ? 'sm:border-nham-border/40 sm:border-l' : undefined
                }
              >
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 border-nham-border/30 border-b px-4 py-3 last:border-b-0 sm:px-5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-nham-track" />
                    <div className="h-3 flex-1 rounded-full bg-nham-track" />
                    <div className="h-3 w-12 rounded-full bg-nham-track" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Background toggle */}
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded-full bg-nham-track" />
          <div className="h-3 w-20 rounded-full bg-nham-track" />
        </div>

        {/* Pull-quote */}
        <div className="max-w-3xl space-y-2 border-nham-accent/30 border-l-[3px] border-dashed pl-5">
          <div className="h-3 w-24 rounded-full bg-nham-track" />
          <div className="h-4 w-full rounded-full bg-nham-track" />
          <div className="h-4 w-5/6 rounded-full bg-nham-track" />
        </div>
      </div>
    </main>
  );
}
