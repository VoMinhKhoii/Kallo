'use client';

import { useCallback, useRef } from 'react';

/**
 * Prevents double-submission of async operations.
 *
 * Usage:
 * ```ts
 * const { guard, isSubmitting } = useSubmitGuard();
 * const handleSubmit = () => guard(async () => { ... });
 * ```
 */
export function useSubmitGuard() {
  const isSubmittingRef = useRef(false);

  const guard = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (isSubmittingRef.current) return undefined;
      isSubmittingRef.current = true;
      try {
        return await fn();
      } finally {
        isSubmittingRef.current = false;
      }
    },
    []
  );

  const isSubmitting = useCallback(() => isSubmittingRef.current, []);

  return { guard, isSubmitting };
}
