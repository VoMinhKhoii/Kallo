'use client';

import { type RefObject, useEffect, useRef } from 'react';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

/**
 * URL arrivals only fill and focus the composer. Sending requires the user's
 * submit gesture; URL text is never authority to start an analysis.
 */
export function useMealPrefill(args: {
  initialMeal: string | undefined;
  inputRef: RefObject<MealInputHandle | null>;
  onInitialMealApplied: (() => void) | undefined;
}) {
  const { initialMeal, inputRef, onInitialMealApplied } = args;

  const lastPrefilledMealRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialMeal) {
      lastPrefilledMealRef.current = null;
      return;
    }
    if (lastPrefilledMealRef.current === initialMeal) return;
    lastPrefilledMealRef.current = initialMeal;
    inputRef.current?.setText(initialMeal);
    inputRef.current?.focus();
    onInitialMealApplied?.();
  }, [initialMeal, onInitialMealApplied, inputRef]);
}
