'use client';

import type { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type {
  ShareDraft,
  ShareMealRequest,
} from '@/hooks/social/sharing/use-share-draft';

/**
 * Posting the share, held behind its undo.
 *
 * Nothing is sent when the dialog closes. The request waits out the toast and
 * is posted only when it closes without "Undo", so undo just drops it — no
 * server round trip, and no friend is notified of a share that was taken back.
 * Same shape as removing a meal (`use-meal-card-actions.ts`).
 *
 * It does NOT know the wire format: the draft owns that, so the two cannot
 * drift.
 */
export function useShareSubmit({
  draft,
  mealId,
  mode,
  share,
  t,
  onDone,
}: {
  draft: ShareDraft;
  mealId: string;
  mode: 'whole' | 'split';
  share: {
    mutate: (vars: ShareMealRequest, opts?: { onError?: () => void }) => void;
  };
  t: ReturnType<typeof useTranslations>;
  onDone: () => void;
}) {
  return () => {
    const count = draft.seated.length;
    if (count === 0) {
      return;
    }
    const isSplit = mode === 'split';
    const request = draft.submission(mealId, isSplit);

    // Settles exactly once: sonner can fire both onAutoClose and onDismiss.
    let settled = false;
    const commit = () => {
      if (settled) return;
      settled = true;
      share.mutate(request, { onError: () => toast.error(t('error')) });
    };

    toast.success(
      isSplit ? t('splitSuccess', { count }) : t('copySuccess', { count }),
      {
        duration: 5000,
        action: {
          label: t('undo'),
          onClick: () => {
            settled = true;
          },
        },
        onAutoClose: commit,
        onDismiss: commit,
      }
    );
    onDone();
  };
}
