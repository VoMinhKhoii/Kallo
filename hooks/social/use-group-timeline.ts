'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { chatGroupsKeys } from '@/hooks/social/use-chat-groups';
import {
  fetchGroupTimeline,
  type GroupTimelineMessageEntry,
  type GroupTimelinePage,
  sendGroupMessage,
} from '@/lib/chat-groups/client';
import type { PublicProfile } from '@/lib/groups/client';

/** The merged group timeline. First-page reads refresh the group list because
 * the server advances this member's read marker after a successful fetch. */
export function useGroupTimeline(groupId: string) {
  const queryClient = useQueryClient();
  return useInfiniteQuery<GroupTimelinePage>({
    queryKey: chatGroupsKeys.timeline(groupId),
    queryFn: async ({ pageParam }) => {
      const page = await fetchGroupTimeline(
        groupId,
        pageParam as string | undefined
      );
      // Only the list prefix — never `all`, which prefixes this timeline query
      // and would invalidate itself into a refetch loop.
      if (pageParam === undefined) {
        queryClient.invalidateQueries({ queryKey: chatGroupsKeys.lists() });
      }
      return page;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  });
}

/** Send through the existing message endpoint, then prepend its fully-shaped
 * post to page one without refetching or disturbing older-page scroll state. */
export function useSendGroupMessage(
  groupId: string,
  author: PublicProfile | undefined
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendGroupMessage(groupId, body),
    onSuccess: (message) => {
      if (!author) return;
      const entry: GroupTimelineMessageEntry = {
        type: 'message',
        id: message.id,
        author,
        isSelf: true,
        body: message.body,
        sentAt: message.createdAt,
      };
      queryClient.setQueryData<InfiniteData<GroupTimelinePage>>(
        chatGroupsKeys.timeline(groupId),
        (current) => {
          if (!current?.pages[0]) return current;
          const [firstPage, ...olderPages] = current.pages;
          return {
            ...current,
            pages: [
              {
                ...firstPage,
                entries: [entry, ...firstPage.entries],
              },
              ...olderPages,
            ],
          };
        }
      );
    },
  });
}
