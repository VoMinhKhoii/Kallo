'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseNutritionShellEffectsParams {
  selectedIndex: number | null;
  clearSelection: () => void;
  isError: boolean;
  error: unknown;
  errorToast: string;
}

/**
 * The two ambient effects of the nutrition page, lifted out of the shell to
 * keep it under the component line budget: document-level Escape while a
 * bucket is selected, and a once-per-error-episode toast.
 */
export function useNutritionShellEffects({
  selectedIndex,
  clearSelection,
  isError,
  error,
  errorToast,
}: UseNutritionShellEffectsParams) {
  const hasShownErrorToast = useRef(false);

  // A pointer click on a column focuses nothing, so the container's onKeyDown
  // never receives the Escape that follows. Listen at the document while a
  // selection is live; the container handler still serves the keyboard path.
  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedIndex, clearSelection]);

  useEffect(() => {
    if (!isError) {
      hasShownErrorToast.current = false;
      return;
    }
    if (hasShownErrorToast.current) return;
    hasShownErrorToast.current = true;
    console.error('[nutrition] overview query failed', error);
    toast.error(errorToast);
  }, [isError, error, errorToast]);
}
