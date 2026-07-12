'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type ChatGroupDetail,
  type ChatGroupIdentity,
  createChatGroup,
  fetchChatGroup,
  fetchGroupMealFeed,
  fetchMyChatGroups,
  type GroupMealFeedPage,
} from '@/lib/chat-groups/client';

export const chatGroupsKeys = {
  all: ['chat-groups'] as const,
  list: (timezoneOffset: number) =>
    ['chat-groups', 'list', timezoneOffset] as const,
  detail: (groupId: string) => ['chat-groups', groupId] as const,
  feed: (groupId: string) => ['chat-groups', groupId, 'feed'] as const,
};

/** Every chat (direct + group) the actor belongs to. */
export function useMyChatGroups() {
  const timezoneOffset = new Date().getTimezoneOffset();
  return useQuery<ChatGroupIdentity[]>({
    queryKey: chatGroupsKeys.list(timezoneOffset),
    queryFn: () => fetchMyChatGroups(timezoneOffset),
  });
}

/** Create a named group chat from a multi-select of the actor's friends. */
export function useCreateChatGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; memberUserIds: string[] }) =>
      createChatGroup(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatGroupsKeys.all });
    },
  });
}

/** A group's detail + member list. */
export function useChatGroup(groupId: string) {
  return useQuery<ChatGroupDetail>({
    queryKey: chatGroupsKeys.detail(groupId),
    queryFn: () => fetchChatGroup(groupId),
  });
}

/** This group's shared-meal history, newest page first — scroll up
 * (`fetchNextPage`) to load earlier shares. First page is today's or, if
 * quiet today, the most recent shares regardless of day.
 *
 * `staleTime` applies to the whole paginated query, not per-page — so this
 * can't mark today's page "fresh" while treating older pages as permanent
 * the way `useDailyMeals` does. 5min (matching that hook's past-day value)
 * is the reasonable middle ground: re-opening a thread within that window
 * reuses everything already scrolled through — including scroll position —
 * instead of refetching and snapping back to today. */
export function useGroupMealFeed(groupId: string) {
  return useInfiniteQuery<GroupMealFeedPage>({
    queryKey: chatGroupsKeys.feed(groupId),
    queryFn: ({ pageParam }) =>
      fetchGroupMealFeed(groupId, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  });
}
