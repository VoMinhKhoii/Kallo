'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { IngredientCombobox } from '@/components/logging/input/manual/ingredient-combobox';
import { cn } from '@/lib/core/ui/cn';
import {
  formatKcal,
  formatMacro,
  type ManualMealRow,
  rowMacros,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';

interface ManualLoggingControlsProps {
  disabled?: boolean;
  rows: ManualMealRow[];
  onRowChange: (id: string, patch: Partial<Omit<ManualMealRow, 'id'>>) => void;
  onRowAdd: (afterId?: string) => string;
  onRowRemove: (id: string) => void;
}

/** Manual mode's ingredient rows: a searchable food picker plus grams per row,
 *  with a running total underneath. Row state is owned by the composer. */
export function ManualLoggingControls({
  disabled,
  rows,
  onRowChange,
  onRowAdd,
  onRowRemove,
}: ManualLoggingControlsProps) {
  const t = useTranslations('logging');
  const searchRefs = useRef(new Map<string, HTMLInputElement | null>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    searchRefs.current.get(target)?.focus();
  });

  const totals = totalsForRows(rows);
  const hasTotals = totals.caloriesKcal != null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {/* "Add food" sits ABOVE the rows; new rows are prepended so the list
            grows upward toward this button. */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            pendingFocus.current = onRowAdd();
          }}
          className="flex items-center gap-1.5 px-1 py-1 font-sans-display text-kallo-text-muted/60 text-sm transition-colors hover:text-kallo-text-muted focus-visible:outline-none disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('manualLogging.addItem')}
        </button>

        {rows.map((row, idx) => {
          const macros = rowMacros(row);
          return (
            <div key={row.id} className="flex items-start gap-2">
              <IngredientCombobox
                rowId={row.id}
                query={row.query}
                ingredient={row.ingredient}
                disabled={disabled}
                autoFocus={idx === 0}
                onQueryChange={(text) =>
                  onRowChange(row.id, { query: text, ingredient: null })
                }
                onSelect={(ingredient) =>
                  onRowChange(row.id, {
                    ingredient,
                    // Keep the user's typed text; only borrow the DB name when
                    // they picked a recent without typing anything.
                    query: row.query.trim() || ingredient.namePrimary,
                  })
                }
                inputRef={(el) => {
                  searchRefs.current.set(row.id, el);
                }}
              />
              <div className="relative w-[92px] shrink-0">
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.grams}
                  onChange={(e) =>
                    onRowChange(row.id, { grams: e.target.value })
                  }
                  placeholder={t('manualLogging.gramsPlaceholder')}
                  aria-label={t('manualLogging.gramsLabel')}
                  disabled={disabled}
                  className="w-full rounded-xl border border-kallo-border/50 bg-kallo-hover/10 py-2 pr-7 pl-3 font-sans-display text-kallo-text text-sm tabular-nums transition-colors placeholder:text-kallo-text-muted/40 focus:border-kallo-accent/50 focus:outline-none disabled:opacity-50"
                />
                <span
                  aria-hidden
                  className="absolute top-1/2 right-3 -translate-y-1/2 font-sans-display text-kallo-text-muted/50 text-xs"
                >
                  {t('manualLogging.gramsUnit')}
                </span>
              </div>
              <span className="w-14 shrink-0 text-right font-sans-display text-kallo-text-muted text-xs tabular-nums">
                {macros
                  ? t('manualLogging.rowKcal', {
                      kcal: formatKcal(macros.caloriesKcal),
                    })
                  : ''}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRowRemove(row.id)}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-kallo-text-muted/40 transition-colors',
                  'hover:bg-kallo-hover/30 hover:text-kallo-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40',
                  rows.length <= 1 && 'invisible'
                )}
                aria-label={t('manualLogging.removeItem')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {hasTotals && (
        <div className="flex items-baseline justify-between border-kallo-border/30 border-t pt-2.5">
          <span className="font-sans-display text-kallo-text-muted text-sm">
            {t('manualLogging.total')}
          </span>
          <div className="flex items-baseline gap-3 font-sans-display tabular-nums">
            <span className="font-medium text-kallo-text text-sm">
              {t('manualLogging.totalKcal', {
                kcal: formatKcal(totals.caloriesKcal),
              })}
            </span>
            <span className="text-kallo-text-muted text-xs">
              {t('manualLogging.totalMacros', {
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
