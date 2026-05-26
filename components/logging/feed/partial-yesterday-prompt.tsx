'use client';

import { AlertCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLoggingDay } from '@/hooks/use-logging-day';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import { isLikelyPartialDay } from '@/lib/nutrition/pattern/completeness';

interface PartialYesterdayPromptProps {
  userId: string;
  yesterday: string;
  calorieTarget: number;
  onOpenDay: (date: string) => void;
}

function dismissKey(date: string): string {
  return `nham:partial-day-dismissed:${date}`;
}

export function PartialYesterdayPrompt({
  userId,
  yesterday,
  calorieTarget,
  onOpenDay,
}: PartialYesterdayPromptProps) {
  const t = useTranslations('logging.feedArea.partialYesterdayPrompt');
  const { data } = useLoggingDay(userId, yesterday);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey(yesterday)) === '1');
  }, [yesterday]);

  const meals = data?.persistedMeals ?? [];
  const hasMeals = meals.length > 0;
  const unknownMacros = meals.some(
    (meal) => meal.nutrition.caloriesKcal == null
  );
  const calories = Math.round(
    sumDisplayedNutrition(meals.map((meal) => meal.nutrition)).caloriesKcal ?? 0
  );

  if (
    dismissed ||
    !hasMeals ||
    unknownMacros ||
    !isLikelyPartialDay(calories, calorieTarget)
  ) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(dismissKey(yesterday), '1');
    setDismissed(true);
  };

  return (
    <div className="shrink-0 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-4xl">
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 sm:p-4"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-900 text-sm">{t('title')}</p>
            <p className="mt-0.5 text-[13px] text-amber-800/90">
              {t('body', { calories, target: calorieTarget })}
            </p>
            <button
              type="button"
              onClick={() => onOpenDay(yesterday)}
              className="mt-2 inline-flex min-h-8 items-center rounded-full bg-amber-100 px-3 py-1.5 font-medium text-amber-900 text-sm transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              {t('open')}
            </button>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('dismiss')}
            className="shrink-0 rounded-full p-1 text-amber-700/80 transition-colors hover:bg-amber-100 hover:text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
