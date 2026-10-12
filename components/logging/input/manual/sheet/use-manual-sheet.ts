'use client';

import { useState } from 'react';
import type { ManualSheetItem } from '@/lib/domain/logging/manual-display';
import {
  type IngredientSearchResult,
  isManualMealFull,
} from '@/lib/domain/logging/manual-logging';

/**
 * The phone sheets' meal: the foods on the plate, each weighed as it went in,
 * and the optional name. The launcher resets it as each new sheet opens.
 */
export function useManualSheet() {
  const [items, setItems] = useState<ManualSheetItem[]>([]);
  const [name, setName] = useState('');

  return {
    items,
    name,
    setName,
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
    reset: () => {
      setItems([]);
      setName('');
    },
  };
}

export type ManualSheetState = ReturnType<typeof useManualSheet>;
