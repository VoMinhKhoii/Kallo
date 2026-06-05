'use client';

import { ChevronDown, PartyPopper } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import { Badge } from '@/components/ui/badge';
import type { PersistedMeal } from '@/lib/actions/meals';
import {
  activeAnchorLabel,
  CHEAT_SLIDER_COLORS,
} from '@/lib/cheat/slider-nutrition';
import { cn } from '@/lib/utils';

interface CheatMealCardProps {
  meal: PersistedMeal;
}

/** Six dots filled up to the chosen stop — where on the scale the user landed. */
function StopScale({ level, color }: { level: number; color: string }) {
  const filled = Math.min(6, Math.max(1, Math.round(level / 2) + 1));
  return (
    <span aria-hidden className="flex items-center gap-0.5">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i >= filled && 'border border-nham-border'
          )}
          style={i < filled ? { backgroundColor: color } : undefined}
        />
      ))}
    </span>
  );
}

export function CheatMealCard({ meal }: CheatMealCardProps) {
  const t = useTranslations('logging.cheatMealCard');
  const [isCollapsed, setIsCollapsed] = useState(true);

  const timeLabel = new Date(meal.loggedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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
      className="group relative"
    >
      {/* Timeline dot & line — warm accent, never red */}
      <div className="absolute top-2 bottom-0 -left-4 w-px bg-nham-border/60 group-last:bg-transparent sm:-left-10" />
      <div className="absolute top-2 -left-5 h-2 w-2 rounded-full border-2 border-nham-accent bg-nham-accent sm:-left-[43px]" />

      <div className="mb-2">
        <span
          className="font-bold text-[11px] text-nham-text-muted/60 tracking-widest"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {timeLabel}
        </span>
      </div>

      <div className="rounded-2xl border border-nham-accent/30 bg-nham-accent/[0.04] p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge
              className="mb-2 gap-1 border-transparent bg-nham-accent/15 text-nham-text"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <PartyPopper className="h-3 w-3" />
              {t('badge')}
            </Badge>
            <p
              className="text-[17px] text-nham-text leading-relaxed sm:text-[19px]"
              style={{ fontFamily: 'Lora, serif' }}
            >
              {meal.rawInput}
            </p>
          </div>
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
                {meal.alcoholG != null && meal.alcoholG > 0
                  ? `  ${t('alcoholShort')}: ${formatMacroOrNA(meal.alcoholG)}`
                  : ''}
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
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
              <div className="mt-5 border-nham-border border-t border-dashed pt-4">
                {/* "You set" slider summary */}
                {persisted && (
                  <div className="mb-4 space-y-2">
                    <span
                      className="font-bold text-[11px] text-nham-text-muted/70 tracking-widest"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {t('youSet')}
                    </span>
                    {persisted.spec.sliders.map((slider) => {
                      const level =
                        persisted.levels[slider.key] ?? slider.defaultLevel;
                      return (
                        <div
                          key={slider.key}
                          className="flex items-center justify-between gap-3 text-[13px]"
                          style={{ fontFamily: 'DM Sans, sans-serif' }}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="font-medium text-nham-text">
                              {slider.label}
                            </span>
                            <StopScale
                              level={level}
                              color={CHEAT_SLIDER_COLORS[slider.key]}
                            />
                          </span>
                          <span className="min-w-0 truncate text-right text-nham-text-muted text-xs">
                            {activeAnchorLabel(slider, level)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                        {meal.alcoholG != null && meal.alcoholG > 0
                          ? `  ${t('alcoholShort')}: ${formatMacroOrNA(meal.alcoholG)}`
                          : ''}
                      </span>
                      <span
                        className="font-bold text-nham-text tabular-nums"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {caloriesApprox}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reassurance */}
                <p
                  className="mt-4 text-[12px] text-nham-text-muted/80 italic leading-relaxed"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {t('reassurance')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
