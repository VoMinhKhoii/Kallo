'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { PersistedMeal } from '@/lib/actions/meals';

interface PersistedMealCardProps {
  meal: PersistedMeal;
}

function formatMacro(value: number | null): string {
  return value == null ? 'N/A' : `${Math.round(value)}g`;
}

function formatCalories(value: number | null): string {
  return value == null ? 'N/A' : `${Math.round(value)} kcal`;
}

export function PersistedMealCard({ meal }: PersistedMealCardProps) {
  const t = useTranslations('logging.persistedMealCard');
  const [isCollapsed, setIsCollapsed] = useState(true);

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const calories = formatCalories(meal.nutrition.caloriesKcal);
  const protein = formatMacro(meal.nutrition.proteinG);
  const carbs = formatMacro(meal.nutrition.carbohydrateG);
  const fat = formatMacro(meal.nutrition.fatG);

  return (
    <motion.article
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
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[17px] text-nham-text leading-relaxed"
            style={{ fontFamily: 'Lora, serif' }}
          >
            &ldquo;{meal.rawInput}&rdquo;
          </p>
          <button
            type="button"
            aria-label={t('toggleDetails')}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-full p-1 text-nham-text-muted/60 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Collapsed summary */}
        <AnimatePresence initial={false}>
          {isCollapsed && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex items-center justify-between"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <span className="text-[11px] text-nham-text-muted tabular-nums">
                P: {protein}
                {'  '}C: {carbs}
                {'  '}F: {fat}
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
                {calories}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-5 border-nham-border border-t border-dashed pt-4">
                <div className="mb-4 space-y-1">
                  {meal.mealItemGroups.map((group) => {
                    const gProtein = formatMacro(group.nutrition.proteinG);
                    const gCarbs = formatMacro(group.nutrition.carbohydrateG);
                    const gFat = formatMacro(group.nutrition.fatG);
                    const gCal = formatCalories(group.nutrition.caloriesKcal);
                    return (
                      <div
                        key={`${group.order}-${group.name}`}
                        className="flex items-center justify-between py-2 text-[13px]"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        <span className="min-w-0 truncate font-medium text-nham-text">
                          {group.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex gap-2 text-[10px] text-nham-text-muted tabular-nums">
                            <span className="text-right">P:{gProtein}</span>
                            <span className="text-right">C:{gCarbs}</span>
                            <span className="text-right">F:{gFat}</span>
                          </div>
                          <span className="text-right font-bold text-nham-text tabular-nums">
                            {gCal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-nham-border/50 border-t border-dashed pt-3">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-bold text-[13px] text-nham-text"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span
                        className="text-[11px] text-nham-text-muted tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        P: {protein}
                        {'  '}C: {carbs}
                        {'  '}F: {fat}
                      </span>
                      <span
                        className="font-bold text-nham-text tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {calories}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
