'use client';

import { type RefObject, useEffect, useRef } from 'react';
import type { MealInputHandle } from '@/components/logging/input/meal-input';

/**
 * Dashboard→logging handoff: prefill the composer from `initialMeal` and
 * auto-submit it once (the dashboard composer used to only re-insert the
 * text, forcing a second tap — the double-submit). Cheat handoffs go through
 * their own slider path, so only precise text auto-submits.
 */
export function useMealPrefill(args: {
  initialMeal: string | undefined;
  isCheat: boolean;
  isAnalyzing: boolean;
  inputRef: RefObject<MealInputHandle | null>;
  onInitialMealApplied: (() => void) | undefined;
  handleSubmit: () => Promise<void> | void;
}) {
  const {
    initialMeal,
    isCheat,
    isAnalyzing,
    inputRef,
    onInitialMealApplied,
    handleSubmit,
  } = args;

  const lastPrefilledMealRef = useRef<string | null>(null);
  // Kept in a ref so the prefill effect (which runs before handleSubmit is
  // defined) can arm the auto-submit without a dependency cycle.
  const pendingAutoSubmitRef = useRef(false);

  // Prefill from dashboard meal trigger; re-runs when initialMeal changes so
  // repeated dashboard→logging handoffs while the component stays mounted work.
  useEffect(() => {
    if (!initialMeal || lastPrefilledMealRef.current === initialMeal) return;
    lastPrefilledMealRef.current = initialMeal;
    inputRef.current?.setText(initialMeal);
    inputRef.current?.focus();
    pendingAutoSubmitRef.current = !isCheat;
    onInitialMealApplied?.();
  }, [initialMeal, isCheat, onInitialMealApplied, inputRef]);

  // Fire the armed handoff once the input is prefilled and not already
  // analyzing. handleSubmit reads the freshly-set text from the input ref.
  useEffect(() => {
    if (!pendingAutoSubmitRef.current || isAnalyzing) return;
    pendingAutoSubmitRef.current = false;
    void handleSubmit();
  }, [handleSubmit, isAnalyzing]);
}
