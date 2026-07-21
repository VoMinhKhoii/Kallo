'use client';

import { Loader2, Minus, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { PersistedMeal } from '@/lib/actions/meals/types';
import { MIN_DISH_GRAMS } from '@/lib/meal-utils';
import { cn } from '@/lib/utils';

// The NL-refine is submitted as `${rawInput} (${correction})` — the joining
import type { MealAmountEdit } from './persisted-meal-card';
import { RefineField } from './refine-field';

interface EditableRow {
  id: string;
  name: string;
  grams: number | null;
  removed: boolean;
}

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

  // Flatten the meal's ingredient rows (each carries a stable id + grams) into
  // the editable working set. Removals and gram steps mutate local state only;
  // nothing persists until Save.
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
    <div className="mt-5 border-nham-border border-t border-dashed pt-4">
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-[13px]',
              row.removed ? 'opacity-40' : 'bg-nham-hover/30',
              'font-sans-display'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {row.grams != null && !row.removed && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={t('removeRow', { name: row.name })}
                    disabled={row.grams <= MIN_DISH_GRAMS}
                    onClick={() => stepGrams(row.id, -10)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border/60 bg-white text-nham-text-muted transition-colors hover:bg-nham-hover disabled:opacity-40"
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="w-9 text-center font-semibold text-[11px] text-nham-text tabular-nums">
                    {Math.round(row.grams)}g
                  </span>
                  <button
                    type="button"
                    onClick={() => stepGrams(row.id, 10)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border/60 bg-white text-nham-text-muted transition-colors hover:bg-nham-hover"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              <span
                className={cn(
                  'truncate font-medium text-nham-text',
                  row.removed && 'line-through'
                )}
              >
                {row.name}
              </span>
            </div>
            <button
              type="button"
              aria-label={t('removeRow', { name: row.name })}
              aria-pressed={row.removed}
              onClick={() => toggleRemove(row.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-nham-text-muted/70 transition-colors hover:bg-nham-danger/10 hover:text-nham-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Natural-language refine — talk to fix it, the same way you logged it. */}
      {onRefine && (
        <div className="mt-4 border-nham-border/50 border-t border-dashed pt-4">
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
