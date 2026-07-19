'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { toggleShareReaction } from '@/lib/groups/client';
import { isFeedQuery, mapFeedEntries } from '@/lib/groups/feed-cache';

interface ReactionResult {
  reacted: boolean;
  count: number;
}

interface CachedReaction {
  mine: boolean;
  count: number;
}

function updateEntry(
  value: unknown,
  shareId: string,
  result?: ReactionResult
): unknown {
  if (!value || typeof value !== 'object') return value;
  const entry = value as Record<string, unknown>;
  const meal = entry.meal;
  if (!meal || typeof meal !== 'object') return value;
  if ((meal as Record<string, unknown>).shareId !== shareId) return value;
  const current = entry.reactions as CachedReaction | undefined;
  const reactions: CachedReaction = result
    ? { mine: result.reacted, count: result.count }
    : current
      ? {
          mine: !current.mine,
          count: Math.max(0, current.count + (current.mine ? -1 : 1)),
        }
      : { mine: true, count: 1 };
  return {
    ...entry,
    reactions,
  };
}

function updateFeedData(
  value: unknown,
  shareId: string,
  result?: ReactionResult
): unknown {
  return mapFeedEntries(value, (entry) => updateEntry(entry, shareId, result));
}

/** Optimistically toggle one share across every mounted feed shape. Failed
 * mutations toggle only that share back so unrelated cache updates survive;
 * successful ones reconcile every occurrence to the authoritative count. */
export function useToggleReaction() {
  const t = useTranslations('groups.feed');
  const queryClient = useQueryClient();
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isFeedQuery(query.queryKey),
  };

  return useMutation({
    mutationFn: (shareId: string) => toggleShareReaction(shareId),
    onMutate: async (shareId) => {
      await queryClient.cancelQueries(filters);
      // Snapshot every affected feed so a failure restores the exact prior
      // state — re-toggling on error would invert any concurrent authoritative
      // update that landed while this request was in flight.
      const snapshot = queryClient.getQueriesData(filters);
      queryClient.setQueriesData(filters, (current) =>
        updateFeedData(current, shareId)
      );
      return { snapshot };
    },
    onError: (_error, _shareId, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(t('reactionError'));
    },
    onSuccess: (result, shareId) => {
      queryClient.setQueriesData(filters, (current) =>
        updateFeedData(current, shareId, result)
      );
    },
  });
}
