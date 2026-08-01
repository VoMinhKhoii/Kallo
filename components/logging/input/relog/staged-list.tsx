'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { StagedRow } from '@/components/logging/input/relog/staged-row';
import type { IngredientMacrosPer100g } from '@/lib/logging/manual-logging';
import { formatKcal, formatMacro } from '@/lib/logging/manual-logging';
import type { RelogStagedEntry } from '@/lib/logging/relog/relog';

interface StagedListProps {
  entries: RelogStagedEntry[];
  totals: IngredientMacrosPer100g;
  disabled?: boolean;
  onRemove: (stageId: string) => void;
}

/** The staged picks above the composer, in the slot manual mode's rows occupy.
 *  Totals reuse the manual-logging markup so the two lists read as one system. */
export function StagedList({
  entries,
  totals,
  disabled,
  onRemove,
}: StagedListProps) {
  const t = useTranslations('logging.relog');
  if (entries.length === 0) return null;

  const hasTotals = totals.caloriesKcal != null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.stageId}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <StagedRow
                entry={entry}
                disabled={disabled}
                onRemove={() => onRemove(entry.stageId)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasTotals && (
        <div className="flex items-baseline justify-between border-nham-border/30 border-t pt-2.5">
          <span className="font-sans-display text-nham-text-muted text-sm">
            {t('total')}
          </span>
          <div className="flex items-baseline gap-3 font-sans-display tabular-nums">
            <span className="font-medium text-nham-text text-sm">
              {t('totalKcal', { kcal: formatKcal(totals.caloriesKcal) })}
            </span>
            <span className="text-nham-text-muted text-xs">
              {t('totalMacros', {
                protein: formatMacro(totals.proteinG),
                carbs: formatMacro(totals.carbohydrateG),
                fat: formatMacro(totals.fatG),
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
