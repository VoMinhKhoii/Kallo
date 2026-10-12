'use client';

import { useTranslations } from 'next-intl';
import { MacroRing } from '@/components/shared/gauge/macro-ring';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
} from '@/components/shared/nutrition/composition';
import { cn } from '@/lib/core/ui/cn';
import { formatGrams } from '@/lib/domain/logging/manual-display';
import type { IngredientMacrosPer100g } from '@/lib/domain/logging/manual-logging';

/**
 * The meal at a glance (approved canvas, E1): the macro ring with its
 * calories, and the three macros in grams beside it — each row wearing the
 * glyph and pigment of the segment it names. No card behind it: it is read,
 * never tapped. `compact` is the desktop composer's smaller ring.
 */
export function ManualMealTotals({
  totals,
  compact = false,
}: {
  totals: IngredientMacrosPer100g;
  compact?: boolean;
}) {
  const t = useTranslations('logging');
  const grams = {
    protein: totals.proteinG,
    carbohydrate: totals.carbohydrateG,
    fat: totals.fatG,
  };
  const labels = {
    protein: t('barcodeProtein'),
    carbohydrate: t('barcodeCarbs'),
    fat: t('barcodeFat'),
  };
  return (
    <div
      className={cn('flex items-center', compact ? 'gap-4' : 'gap-6 px-1 pt-1')}
    >
      <MacroRing
        kcal={totals.caloriesKcal ?? 0}
        grams={grams}
        size={compact ? 72 : 128}
        thickness={compact ? 7 : 12}
      />
      {/* On the wide composer the list keeps a reading width, so a value sits
          by its label instead of at the far edge of the card. */}
      <ul className={cn('min-w-0 flex-1', compact && 'max-w-56')}>
        {COMPOSITION_KEYS.map((key, index) => {
          const Icon = COMPOSITION_ICONS[key];
          return (
            <li
              key={key}
              className={cn(
                'flex items-center gap-2',
                compact ? 'h-6' : 'h-10',
                index > 0 && !compact && 'border-kallo-border border-t'
              )}
            >
              <Icon
                aria-hidden
                className="size-3.5 shrink-0"
                strokeWidth={1.5}
                style={{ color: COMPOSITION_COLORS[key] }}
              />
              <span className="flex-1 truncate text-[14px] text-kallo-text-muted">
                {labels[key]}
              </span>
              <span
                className={cn(
                  'text-kallo-text tabular-nums',
                  compact ? 'text-[14px]' : 'text-[16px] tracking-[-0.2px]'
                )}
              >
                {formatGrams(grams[key] ?? 0)} g
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
