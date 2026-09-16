'use client';

import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type Draft = {
  seated: unknown[];
  parts: number[];
  splitsPayload: () => { userId: string; parts: number }[];
  reset: () => void;
};

/**
 * Posting the share, and the confirmation that carries the undo.
 *
 * Kept out of the dialog because it is the one place the wire format, the
 * toast and the compensating write all meet — and because the dialog is
 * otherwise pure layout.
 */
export function useShareSubmit({
  draft,
  mealId,
  mode,
  share,
  t,
  undo,
  onDone,
}: {
  draft: Draft;
  mealId: string;
  mode: 'whole' | 'split';
  share: {
    isPending: boolean;
    mutate: (
      vars: {
        mealId: string;
        friendUserIds: string[];
        mode: 'copy' | 'split';
        myParts?: number;
        splits?: { userId: string; parts: number }[];
      },
      opts?: { onSuccess?: () => void; onError?: () => void }
    ) => void;
  };
  t: ReturnType<typeof useTranslations>;
  undo: {
    mutate: (vars: { mealId: string }, opts?: { onError?: () => void }) => void;
  };
  onDone: () => void;
}) {
  return () => {
    if (draft.seated.length === 0 || share.isPending) {
      return;
    }
    const isSplit = mode === 'split';
    share.mutate(
      {
        mealId,
        friendUserIds: draft.splitsPayload().map((s) => s.userId),
        mode: isSplit ? 'split' : 'copy',
        // ALWAYS send the parts for a split, even an untouched even one.
        //
        // Skipping them on "even" looked like a safe optimisation and was not:
        // 20 is not divisible by 3, so the meter draws an even three-way split
        // as 7/7/6 (35/35/30) while the server's no-parts path divides 20 by 3
        // exactly. The user confirmed one allocation and the database stored a
        // different one.
        ...(isSplit
          ? { myParts: draft.parts[0], splits: draft.splitsPayload() }
          : {}),
      },
      {
        onSuccess: () => {
          toast.success(
            isSplit
              ? t('splitSuccess', { count: draft.seated.length })
              : t('copySuccess', { count: draft.seated.length }),
            isSplit
              ? {
                  action: {
                    label: t('undo'),
                    onClick: () =>
                      undo.mutate(
                        { mealId },
                        { onError: () => toast.error(t('undoFailed')) }
                      ),
                  },
                }
              : undefined
          );
          onDone();
        },
        onError: () => toast.error(t('error')),
      }
    );
  };
}
