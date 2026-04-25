'use client';

import { useTranslations } from 'next-intl';

export function NutritionSkeleton() {
  const t = useTranslations('nutrition');

  return (
    <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <div
        role="status"
        aria-live="polite"
        aria-label={t('loading')}
        className="motion-safe:animate-pulse"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-48 rounded-full bg-nham-hover" />
            <div className="h-4 w-72 max-w-full rounded-full bg-nham-hover" />
          </div>
          <div className="h-10 w-44 rounded-xl bg-nham-hover" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-32 rounded-2xl border border-nham-border/60 bg-card"
            />
          ))}
        </div>
        <div className="mt-5 h-80 rounded-3xl border border-nham-border/60 bg-card" />
      </div>
    </main>
  );
}
