'use client';

import { useState } from 'react';
import {
  type ManualSheetItem,
  plateTotals,
} from '@/lib/domain/logging/manual-display';
import {
  type IngredientSearchResult,
  isManualMealFull,
} from '@/lib/domain/logging/manual-logging';

/**
 * The phone sheets' meal: the foods on the plate, each weighed as it went in,
 * the optional name, and what the plate adds up to.
 *
 * Each open is a new meal, as on iOS: whatever plate a closed sheet left
 * behind is dropped the moment the next one opens — however it was closed
 * (saved, X, swipe, overlay), and never while it is still sliding away.
 */
export function useManualSheet(open: boolean) {
  const [items, setItems] = useState<ManualSheetItem[]>([]);
  const [name, setName] = useState('');
  const [shown, setShown] = useState(open);
  if (open !== shown) {
    setShown(open);
    if (open) {
      setItems([]);
      setName('');
    }
  }

  return {
    items,
    name,
    setName,
    /** Empty plate 0; a nutrient none of its foods carries, null. */
    totals: plateTotals(items),
    /** As many foods as a meal may hold: a new one cannot go in. */
    full: isManualMealFull(items.length),
    add: (ingredient: IngredientSearchResult, grams: number) =>
      setItems((prev) =>
        isManualMealFull(prev.length)
          ? prev
          : [...prev, { id: crypto.randomUUID(), ingredient, grams }]
      ),
    update: (id: string, grams: number) =>
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, grams } : item))
      ),
    remove: (id: string) =>
      setItems((prev) => prev.filter((item) => item.id !== id)),
    itemFor: (ingredientId: string) =>
      items.find((item) => item.ingredient.id === ingredientId) ?? null,
  };
}

export type ManualSheetState = ReturnType<typeof useManualSheet>;
