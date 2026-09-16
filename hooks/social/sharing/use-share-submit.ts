'use client';

import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type {
  ShareDraft,
  ShareMealRequest,
} from '@/hooks/social/sharing/use-share-draft';

/**
 * Posting the share, and the confirmation that carries the undo.
 *
 * Kept out of the dialog because it is the one place the mutation, the toast
 * and the compensating write meet — and because the dialog is otherwise pure
 * layout. It does NOT know the wire format: the draft owns that, so the two
 * cannot drift.
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
  draft: ShareDraft;
  mealId: string;
  mode: 'whole' | 'split';
  share: {
    isPending: boolean;
    mutate: (
      vars: ShareMealRequest,
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
    const count = draft.seated.length;
    if (count === 0 || share.isPending) {
      return;
    }
    const isSplit = mode === 'split';
    share.mutate(draft.submission(mealId, isSplit), {
      onSuccess: () => {
        toast.success(
          isSplit ? t('splitSuccess', { count }) : t('copySuccess', { count }),
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
    });
  };
}
