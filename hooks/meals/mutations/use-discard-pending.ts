'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';
import { toast } from 'sonner';
import { discardPendingAnalysisAction } from '@/lib/actions/meals/mutate-meal';
import type { LoggingDayData } from '@/lib/actions/meals/types';
import type { ChatMessage } from '@/lib/core/types/meal';
import { dailyMealsKeys, loggingDayKeys } from '@/lib/domain/meals/query-keys';
import { mealShareInvitesKeys } from '@/lib/domain/social/query-keys';

/**
 * Discard an unsaved (staged) card, with the same 5-second undo as removing a
 * saved meal. The card is hidden by analysis id rather than cut out of the
 * message list, so undo is just un-hiding it — the local card keeps its
 * in-progress edits. The server DELETE runs when the toast closes.
 */
export function useDiscardPending(args: {
  userId: string;
  selectedDate: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}) {
  const { userId, selectedDate, setMessages } = args;
  const t = useTranslations('logging.feedArea');
  const queryClient = useQueryClient();
  const [hiddenAnalysisIds, setHiddenAnalysisIds] = useState<
    ReadonlySet<string>
  >(() => new Set());

  const setHidden = useCallback((analysisId: string, hidden: boolean) => {
    setHiddenAnalysisIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(analysisId);
      else next.delete(analysisId);
      return next;
    });
  }, []);

  const handleDiscardPending = useCallback(
    (message: ChatMessage) => {
      const { analysisId } = message;
      if (!analysisId) return;
      setHidden(analysisId, true);

      let undone = false;
      // Gone for good: drop the local card and the server-pending twin, so
      // neither resurfaces once the hide is lifted.
      const dropEverywhere = () => {
        setMessages((prev) => prev.filter((m) => m.analysisId !== analysisId));
        queryClient.setQueriesData<LoggingDayData>(
          { queryKey: loggingDayKeys.byUserDate(userId, selectedDate) },
          (old) =>
            old
              ? {
                  ...old,
                  pendingConfirmations: old.pendingConfirmations.filter(
                    (pending) => pending.id !== analysisId
                  ),
                }
              : old
        );
        setHidden(analysisId, false);
      };
      const commit = async () => {
        if (undone) return;
        undone = true; // onAutoClose and onDismiss can both fire.
        // Expired or already saved comes back as `not_found` — either way the
        // card IS gone, so it stays gone. Only a throw puts it back.
        let result: Awaited<ReturnType<typeof discardPendingAnalysisAction>>;
        try {
          result = await discardPendingAnalysisAction({ analysisId });
        } catch {
          setHidden(analysisId, false);
          toast.error(t('discardError'));
          return;
        }
        dropEverywhere();
        // A real discard changed only what the cache already shows. `not_found`
        // may mean it was SAVED elsewhere (another tab or the app), so the day
        // has a meal this cache lacks — fetch it now rather than on next focus.
        const goneElsewhere = !result.success;
        queryClient.invalidateQueries({
          queryKey: loggingDayKeys.byUserDate(userId, selectedDate),
          refetchType: goneElsewhere ? 'active' : 'none',
        });
        if (goneElsewhere) {
          queryClient.invalidateQueries({
            queryKey: dailyMealsKeys.byDate(selectedDate),
          });
          queryClient.invalidateQueries({ queryKey: ['meal-dates'] });
        }
        // A card staged from a friend's cheat offer hands that offer back, so
        // the inbox must refetch. Only the server knows whether this one did.
        queryClient.invalidateQueries({ queryKey: mealShareInvitesKeys.all });
      };

      toast(t('pendingDiscarded'), {
        duration: 5000,
        action: {
          label: t('undo'),
          onClick: () => {
            undone = true;
            setHidden(analysisId, false);
          },
        },
        onAutoClose: commit,
        onDismiss: commit,
      });
    },
    [userId, selectedDate, queryClient, setMessages, setHidden, t]
  );

  return { hiddenAnalysisIds, handleDiscardPending };
}
