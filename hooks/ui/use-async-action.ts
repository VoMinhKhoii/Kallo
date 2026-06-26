'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

interface RunOptions {
  /** Prefix passed to console.error on failure (e.g. 'Failed to export data:'). */
  logLabel: string;
  /** User-facing toast shown on failure (already localized). */
  errorMessage: string;
  /**
   * Keep `pending` true after a successful run. Use for actions that navigate
   * away on success (sign out, delete) so the trigger stays disabled through
   * the page unload instead of briefly re-enabling.
   */
  keepPendingOnSuccess?: boolean;
}

/**
 * Drives a one-shot async UI action: a `pending` flag plus a `run` that guards
 * against re-entry, flips `pending`, and on failure logs the error and toasts.
 * Replaces the hand-rolled `useState` + try/catch/finally pattern repeated per
 * button. One instance per independent action.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const run = useCallback(
    async (action: () => Promise<void>, opts: RunOptions) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      try {
        await action();
        if (!opts.keepPendingOnSuccess) {
          pendingRef.current = false;
          setPending(false);
        }
      } catch (error) {
        console.error(
          opts.logLabel,
          error instanceof Error ? error.message : String(error)
        );
        toast.error(opts.errorMessage);
        pendingRef.current = false;
        setPending(false);
      }
    },
    []
  );

  return { pending, run };
}
