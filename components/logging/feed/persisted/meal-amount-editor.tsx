'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  formatCaloriesOrNA,
  formatMacroOrNA,
} from '@/components/logging/feed/format-inline-nutrition';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { MIN_DISH_GRAMS } from '@/lib/meal-utils';

import { AmountEditorRow, type EditableRow } from './amount-editor-row';
import type { MealAmountEdit } from './persisted-meal-card';
import { RefineField } from './refine-field';

const TOTAL_FIELDS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
] as const;

/**
 * Natural-language refine input — talk to fix the meal, the same way it was
 * logged. Re-runs the full analysis waterfall on the meal text plus this note,
 * replacing the meal once confirmed. Rendered both from the collapsed card's
 * "Fix with words" action and inside the amount editor.
 */
export function MealAmountEditor({
  meal,
  onCancel,
  onSave,
  onRefine,
}: {
  meal: PersistedMeal;
  onCancel: () => void;
  onSave: (changes: MealAmountEdit) => Promise<void>;
  onRefine?: (correction: string) => void;
}) {
  const t = useTranslations('logging.persistedMealCard');
  const [isSaving, setIsSaving] = useState(false);

  // Removals and gram steps mutate local state only until Save.
  const initialRows = useMemo<EditableRow[]>(
    () =>
      meal.mealItemGroups.flatMap((group) =>
        group.ingredients.map((ing) => ({
          id: ing.id,
          name: ing.ingredientName,
          grams: ing.estimatedGrams,
          removed: false,
        }))
      ),
    [meal.mealItemGroups]
  );
  const [rows, setRows] = useState<EditableRow[]>(initialRows);

  const remaining = rows.filter((r) => !r.removed);
  const totals = useMemo(() => {
    const ingredients = new Map(
      meal.mealItemGroups.flatMap((group) =>
        group.ingredients.map((ingredient) => [ingredient.id, ingredient])
      )
    );
    const sums = Object.fromEntries(TOTAL_FIELDS.map((field) => [field, 0]));
    const hasValue = Object.fromEntries(
      TOTAL_FIELDS.map((field) => [field, false])
    );

    for (const row of rows) {
      if (row.removed) continue;
      const ingredient = ingredients.get(row.id);
      if (!ingredient) continue;
      const scale =
        row.grams == null ||
        ingredient.estimatedGrams == null ||
        ingredient.estimatedGrams === 0
          ? 1
          : row.grams / ingredient.estimatedGrams;
      for (const field of TOTAL_FIELDS) {
        const value = ingredient.nutrition[field];
        if (value == null) continue;
        sums[field] += value * scale;
        hasValue[field] = true;
      }
    }

    return Object.fromEntries(
      TOTAL_FIELDS.map((field) => [field, hasValue[field] ? sums[field] : null])
    ) as Record<(typeof TOTAL_FIELDS)[number], number | null>;
  }, [meal.mealItemGroups, rows]);
  const initialById = useMemo(
    () => new Map(initialRows.map((r) => [r.id, r.grams])),
    [initialRows]
  );

  const stepGrams = (id: string, delta: number) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id === id && r.grams != null
          ? { ...r, grams: Math.max(MIN_DISH_GRAMS, r.grams + delta) }
          : r
      )
    );
  const toggleRemove = (id: string) =>
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, removed: !r.removed } : r))
    );

  const handleSave = async () => {
    if (isSaving) return;
    const removeIds = rows.filter((r) => r.removed).map((r) => r.id);
    const edits = remaining.flatMap((r) => {
      const original = initialById.get(r.id);
      if (r.grams == null || original == null || r.grams === original)
        return [];
      return [{ id: r.id, newGrams: r.grams }];
    });
    if (removeIds.length === 0 && edits.length === 0) {
      onCancel();
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ edits, removeIds });
      onCancel();
    } catch {
      // Error toast is raised by the mutation; keep the editor open to retry.
      setIsSaving(false);
    }
  };

  // Removing the last row would leave an empty meal — disable Save in that case
  // (the user should remove the whole meal instead, via the Remove affordance).
  const canSave = remaining.length > 0;

  return (
    <div className="mt-5 border-nham-border border-t pt-4">
      <div className="space-y-1">
        {rows.map((row) => (
          <AmountEditorRow
            key={row.id}
            row={row}
            onStep={stepGrams}
            onToggleRemove={toggleRemove}
            t={t}
          />
        ))}
      </div>

      <div className="mt-4 border-nham-border/50 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="font-bold font-sans-display text-[13px] text-nham-text">
            {t('total')}
          </span>
          <div className="flex items-center gap-4">
            <span className="font-sans-display text-[11px] text-nham-text-muted tabular-nums">
              P: {formatMacroOrNA(totals.proteinG)}
              {'  '}C: {formatMacroOrNA(totals.carbohydrateG)}
              {'  '}F: {formatMacroOrNA(totals.fatG)}
            </span>
            <span className="font-bold font-sans-display text-nham-text tabular-nums">
              {formatCaloriesOrNA(totals.caloriesKcal)}
            </span>
          </div>
        </div>
      </div>

      {/* Natural-language refine — talk to fix it, the same way you logged it. */}
      {onRefine && (
        <div className="mt-4 border-nham-border/50 border-t pt-4">
          <RefineField meal={meal} onRefine={onRefine} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-nham-text-muted/80 transition-colors hover:bg-nham-hover/40 hover:text-nham-text disabled:opacity-60"
        >
          {t('cancelEdit')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !canSave}
          aria-busy={isSaving}
          className="inline-flex items-center gap-1.5 rounded-full bg-nham-hover px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-nham-text transition-colors hover:bg-nham-hover/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isSaving ? t('savingEdit') : t('saveEdit')}
        </button>
      </div>
    </div>
  );
}
