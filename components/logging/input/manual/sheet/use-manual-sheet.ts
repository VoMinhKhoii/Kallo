'use client';

import { useState } from 'react';
import type { ManualSheetItem } from '@/lib/domain/logging/manual-display';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';

/** The most items one manual meal may hold — the save contract's cap. */
export const MAX_MANUAL_ITEMS = 30;

/**
 * The phone sheets' meal: the foods on the plate, each weighed as it went in,
 * and the optional name. Held by the composer, not the sheet, so an
 * accidental swipe-down keeps the plate — reopening shows it again.
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
        prev.length >= MAX_MANUAL_ITEMS
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
