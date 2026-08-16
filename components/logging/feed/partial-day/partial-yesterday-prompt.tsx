'use client';

import { ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLoggingDay } from '@/hooks/meals/use-logging-day';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import { isLikelyPartialDay } from '@/lib/nutrition/pattern/completeness';

interface PartialYesterdayPromptProps {
  userId: string;
  yesterday: string;
  calorieTarget: number;
  onOpenDay: (date: string) => void;
  onDismiss: () => void;
}

export function PartialYesterdayPrompt({
  userId,
  yesterday,
  calorieTarget,
  onOpenDay,
  onDismiss,
}: PartialYesterdayPromptProps) {
  const t = useTranslations('logging.feedArea.partialYesterdayPrompt');
  const { data } = useLoggingDay(userId, yesterday);

  const meals = data?.persistedMeals ?? [];
  const hasMeals = meals.length > 0;
  // The partial-day check is calorie-based, so a meal with unknown calories
  // makes the day's total untrustworthy; suppress the prompt in that case.
  const hasUnknownCalories = meals.some(
    (meal) => meal.nutrition.caloriesKcal == null
  );
  const calories = Math.round(
    sumDisplayedNutrition(meals.map((meal) => meal.nutrition)).caloriesKcal ?? 0
  );

  if (
    !hasMeals ||
    hasUnknownCalories ||
    !isLikelyPartialDay(calories, calorieTarget)
  ) {
    return null;
  }

  return (
    <div className="shrink-0 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto max-w-4xl">
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-kallo-border/60 bg-white p-3 sm:p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="font-sans-display text-base text-kallo-danger italic">
              {t('title')}
            </p>
            <p className="mt-1 font-sans-display text-[13px] text-kallo-text-muted">
              {t('body', { calories, target: calorieTarget })}
            </p>
            <button
              type="button"
              onClick={() => onOpenDay(yesterday)}
              className="mt-3 inline-flex min-h-8 touch-manipulation items-center gap-2 rounded-full border border-kallo-border/60 px-3 py-1.5 font-medium font-sans-display text-kallo-text text-sm transition-colors hover:border-kallo-accent/50 hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t('open')}
            </button>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('dismiss')}
            className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-full p-1 text-kallo-text-muted transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
