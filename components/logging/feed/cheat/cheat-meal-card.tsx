'use client';

import { ChevronDown, PartyPopper } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheatMealActions } from '@/components/logging/feed/cheat/cheat-meal-actions';
import { StopScale } from '@/components/logging/feed/cheat/cheat-stop-scale';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { TurnHeader } from '@/components/logging/feed/turn/turn-header';
import { Badge } from '@/components/ui/badge';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { formatTime } from '@/lib/core/date/format-time';
import {
  activeAnchorLabel,
  CHEAT_SLIDER_COLORS,
} from '@/lib/domain/cheat/slider-nutrition';

interface CheatMealCardProps {
  meal: PersistedMeal;
  /** Remove this meal (deferred delete with undo handled by the feed). */
  onDelete?: () => void;
}

export function CheatMealCard({ meal, onDelete }: CheatMealCardProps) {
  const t = useTranslations('logging.cheatMealCard');
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const timeLabel = formatTime(meal.loggedAt, locale);

  const calories = formatCaloriesOrNA(meal.nutrition.caloriesKcal);
  // Cheat calories are an estimate the user placed themselves — flag it with ≈
  // (precise meals keep the unprefixed shared formatter untouched).
  const caloriesApprox =
    meal.nutrition.caloriesKcal == null ? calories : `≈ ${calories}`;
  const protein = formatMacroOrNA(meal.nutrition.proteinG);
  const carbs = formatMacroOrNA(meal.nutrition.carbohydrateG);
  const fat = formatMacroOrNA(meal.nutrition.fatG);

  const persisted = meal.cheatSliders;

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative"
    >
      <TurnHeader timeLabel={timeLabel} message={meal.rawInput} />

      <div className="rounded-2xl border border-kallo-accent/30 bg-kallo-accent/[0.04] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge className="mb-2 gap-1 border-transparent bg-kallo-accent/15 font-sans-display text-kallo-text">
              <PartyPopper className="h-3 w-3" />
              {t('badge')}
            </Badge>
            <p className="font-serif text-[17px] text-kallo-text leading-relaxed sm:text-[19px]">
              {meal.rawInput}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('toggleDetails')}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-full p-1 text-kallo-text-muted/60 transition-colors hover:bg-kallo-hover/40 hover:text-kallo-text"
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
              className="mt-2 flex items-center justify-between font-sans-display"
            >
              <span className="text-[11px] text-kallo-text-muted tabular-nums">
                P: {protein}
                {'  '}C: {carbs}
                {'  '}F: {fat}
                {meal.alcoholG != null && meal.alcoholG > 0
                  ? `  ${t('alcoholShort')}: ${formatMacroOrNA(meal.alcoholG)}`
                  : ''}
              </span>
              <span className="font-bold text-kallo-text text-sm tabular-nums">
                {caloriesApprox}
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
              <div className="mt-5 border-kallo-border border-t pt-4">
                {/* "You set" slider summary */}
                {persisted && (
                  <div className="mb-4 space-y-2">
                    <span className="font-bold font-sans-display text-[11px] text-kallo-text-muted/70 tracking-widest">
                      {t('youSet')}
                    </span>
                    {persisted.spec.sliders.map((slider) => {
                      const level =
                        persisted.levels[slider.key] ?? slider.defaultLevel;
                      return (
                        <div
                          key={slider.key}
                          className="flex items-center justify-between gap-3 font-sans-display text-[13px]"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-medium text-kallo-text">
                              {slider.label}
                            </span>
                            <StopScale
                              level={level}
                              color={CHEAT_SLIDER_COLORS[slider.key]}
                            />
                          </span>
                          <span className="min-w-0 truncate text-right text-kallo-text-muted text-xs">
                            {activeAnchorLabel(slider, level)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Totals */}
                <div className="border-kallo-border/50 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-sans-display text-[13px] text-kallo-text">
                      {t('total')}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="font-sans-display text-[11px] text-kallo-text-muted tabular-nums">
                        P: {protein}
                        {'  '}C: {carbs}
                        {'  '}F: {fat}
                        {meal.alcoholG != null && meal.alcoholG > 0
                          ? `  ${t('alcoholShort')}: ${formatMacroOrNA(meal.alcoholG)}`
                          : ''}
                      </span>
                      <span className="font-bold font-sans-display text-kallo-text tabular-nums">
                        {caloriesApprox}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reassurance */}
                <p className="mt-4 font-sans-display text-[12px] text-kallo-text-muted/80 italic leading-relaxed">
                  {t('reassurance')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <CheatMealActions meal={meal} onDelete={onDelete} />
    </motion.article>
  );
}
