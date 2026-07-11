'use client';

import { CheatMealCard } from '@/components/logging/feed/cheat/cheat-meal-card';
import type { PersistedMeal } from '@/lib/actions/meals/types';

// The NL-refine is submitted as `${rawInput} (${correction})` — the joining
import { PrecisePersistedMealCard } from './precise-meal-card';

export interface MealAmountEdit {
  edits: { id: string; newGrams: number }[];
  removeIds: string[];
}

export interface PersistedMealCardProps {
  meal: PersistedMeal;
  /** Remove this meal (deferred delete with undo handled by the feed). */
  onDelete?: () => void;
  /** Re-log: prefill the composer with this meal's raw input. */
  onLogAgain?: () => void;
  /** Persist gram overrides / per-row removals; resolves when saved. */
  onUpdate?: (changes: MealAmountEdit) => Promise<void>;
  /**
   * Natural-language correction: re-run the analysis waterfall on the meal's
   * text plus this correction, replacing the meal once confirmed. Closes the
   * editor and hands off to the feed's streaming surface.
   */
  onRefine?: (correction: string) => void;
}

export function PersistedMealCard({
  meal,
  onDelete,
  onLogAgain,
  onUpdate,
  onRefine,
}: PersistedMealCardProps) {
  // Cheat meals render a dedicated, warmly-decorated card variant; re-logging a
  // cheat occasion has its own slider-seeded path (the occasion chips), so the
  // "Log again" affordance lives only on precise meals.
  if (meal.entryMode === 'cheat') {
    return <CheatMealCard meal={meal} onDelete={onDelete} />;
  }
  return (
    <PrecisePersistedMealCard
      meal={meal}
      onDelete={onDelete}
      onLogAgain={onLogAgain}
      onUpdate={onUpdate}
      onRefine={onRefine}
    />
  );
}
