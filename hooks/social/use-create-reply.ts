'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createShareReply, type ShareReply } from '@/lib/groups/client';
import { isFeedQuery, mapFeedEntries } from '@/lib/groups/feed-cache';

function appendReply(
  entry: unknown,
  shareId: string,
  reply: ShareReply
): unknown {
  if (!entry || typeof entry !== 'object') return entry;
  const record = entry as Record<string, unknown>;
  const meal = record.meal;
  if (!meal || typeof meal !== 'object') return entry;
  if ((meal as Record<string, unknown>).shareId !== shareId) return entry;
  const replies = Array.isArray(record.replies)
    ? (record.replies as ShareReply[])
    : [];
  // Guard against a double-apply if a refetch also lands this reply.
  if (replies.some((existing) => existing.id === reply.id)) return entry;
  const repliesTotal =
    typeof record.repliesTotal === 'number'
      ? record.repliesTotal
      : replies.length;
  return {
    ...record,
    replies: [...replies, reply].slice(-12),
    repliesTotal: repliesTotal + 1,
  };
}

/** Post a reply and splice the authoritative row into every mounted feed that
 * shows this share, so it appears without a refetch. */
export function useCreateReply() {
  const t = useTranslations('groups.feed');
  const queryClient = useQueryClient();
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isFeedQuery(query.queryKey),
  };

  const mutation = useMutation({
    mutationFn: (input: { shareId: string; replyId: string; body: string }) =>
      createShareReply(input),
    onSuccess: (reply, { shareId }) => {
      queryClient.setQueriesData(filters, (current) =>
        mapFeedEntries(current, (entry) => appendReply(entry, shareId, reply))
      );
    },
    onError: () => toast.error(t('replyError')),
  });

  type Input = { shareId: string; body: string };
  const mutate = (
    input: Input,
    options?: Parameters<typeof mutation.mutate>[1]
  ) => mutation.mutate({ ...input, replyId: crypto.randomUUID() }, options);
  const mutateAsync = (
    input: Input,
    options?: Parameters<typeof mutation.mutateAsync>[1]
  ) =>
    mutation.mutateAsync({ ...input, replyId: crypto.randomUUID() }, options);

  return { ...mutation, mutate, mutateAsync };
}
