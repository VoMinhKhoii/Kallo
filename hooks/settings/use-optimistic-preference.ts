'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/**
 * One on/off preference saved on change (the Settings switches: Circle
 * auto-share, meal reminders). Optimistic: flips immediately, rolls back with
 * `errorMessage` as a toast when `save` fails. Not an RHF field — it commits
 * on change, like the language row.
 */
export function useOptimisticPreference({
  initialValue,
  save,
  errorMessage,
}: {
  initialValue: boolean;
  save: (next: boolean) => Promise<unknown>;
  errorMessage: string;
}) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // A value changed elsewhere (another device, the app) arrives as a new prop
  // while the row stays mounted, so `useState(initialValue)` alone would keep
  // showing the old one. Adopt a new server value when one arrives, unless a
  // toggle of ours is still in flight.
  const [seenValue, setSeenValue] = useState(initialValue);
  if (initialValue !== seenValue && !isPending) {
    setSeenValue(initialValue);
    setEnabled(initialValue);
  }

  const onChange = (checked: boolean) => {
    const previous = enabled;
    setEnabled(checked);

    startTransition(async () => {
      try {
        await save(checked);
        // The row remounts from the shell's profile each time its settings
        // page opens; refetch it so coming back shows the saved value.
        router.refresh();
      } catch {
        setEnabled(previous);
        toast.error(errorMessage);
      }
    });
  };

  return { enabled, isPending, onChange };
}
