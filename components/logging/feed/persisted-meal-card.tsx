'use client';

import { ChevronDown, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import type { LoggingProfile } from '@/components/logging/logging-shell';
import type { PersistedMeal } from '@/lib/actions/meals';
import { goalAdjustNutrition } from '@/lib/ai/pipeline/goal-adjustment';

interface PersistedMealCardProps {
  meal: PersistedMeal;
  profile: LoggingProfile;
  onDelete: () => void;
}

export function PersistedMealCard({
  meal,
  profile,
  onDelete,
}: PersistedMealCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const displayed = useMemo(
    () =>
      goalAdjustNutrition(
        meal.boundedNutrition,
        profile.goal,
        profile.aggression
      ),
    [meal.boundedNutrition, profile.goal, profile.aggression]
  );

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const calories = Math.round(displayed.caloriesKcal ?? 0);
  const protein = Math.round(displayed.proteinG ?? 0);
  const carbs = Math.round(displayed.carbohydrateG ?? 0);
  const fat = Math.round(displayed.fatG ?? 0);

  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-10 w-px bg-nham-border/60 group-last:bg-transparent" />
      <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-nham-accent bg-white" />

      {/* Time label */}
      <div className="mb-2">
        <span
          className="font-bold text-[11px] text-nham-text-muted/60 tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[17px] text-nham-text leading-relaxed"
            style={{ fontFamily: 'Lora, serif' }}
          >
            &ldquo;{meal.rawInput}&rdquo;
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Delete meal"
              onClick={onDelete}
              className="rounded-full p-1 text-nham-text-muted/40 transition-colors hover:bg-rose-50 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Toggle meal details"
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="rounded-full p-1 text-nham-text-muted/60 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>
        </div>

        {/* Collapsed summary */}
        {isCollapsed && (
          <div
            className="mt-2 flex items-center justify-between"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <span className="text-[11px] text-nham-text-muted tabular-nums">
              P: {protein}g{'  '}C: {carbs}g{'  '}F: {fat}g
            </span>
            <span className="font-bold text-nham-text text-sm tabular-nums">
              {calories} kcal
            </span>
          </div>
        )}

        {/* Expanded details */}
        {!isCollapsed && (
          <div className="mt-5 border-nham-border border-t border-dashed pt-4">
            <div className="mb-4 space-y-1">
              {meal.mealItemGroups.map((group) => (
                <div key={`${group.order}-${group.name}`}>
                  <p
                    className="mb-1 font-medium text-nham-text text-xs"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {group.name}
                  </p>
                  {group.ingredients.map((ing) => {
                    const ingDisplayed = goalAdjustNutrition(
                      ing.boundedNutrition,
                      profile.goal,
                      profile.aggression
                    );
                    return (
                      <div
                        key={ing.id}
                        className="flex items-center justify-between py-1 pl-3"
                      >
                        <span
                          className="text-nham-text-muted text-xs"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {ing.ingredientName}
                          {ing.estimatedGrams
                            ? ` — ${Math.round(ing.estimatedGrams)}g`
                            : ''}
                        </span>
                        <span
                          className="text-[11px] text-nham-text-muted tabular-nums"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {Math.round(ingDisplayed.caloriesKcal ?? 0)} kcal
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-nham-border/50 border-t border-dashed pt-3">
              <div className="flex items-center justify-between">
                <span
                  className="font-bold text-[13px] text-nham-text"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  Total
                </span>
                <div className="flex items-center gap-4">
                  <span
                    className="text-[11px] text-nham-text-muted tabular-nums"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    P: {protein}g{'  '}C: {carbs}g{'  '}F: {fat}g
                  </span>
                  <span
                    className="font-bold text-nham-text tabular-nums"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {calories} kcal
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}
