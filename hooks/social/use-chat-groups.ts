'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ChatGroupDetail,
  ChatGroupIdentity,
  GroupMealFeedPage,
} from '@/lib/actions/chat-groups/types';
import {
  addGroupMembers,
  createChatGroup,
  fetchChatGroup,
  fetchGroupMealFeed,
  fetchMyChatGroups,
  leaveGroup,
  removeGroupMember,
  renameGroup,
} from '@/lib/social/chat/client';

export const chatGroupsKeys = {
  all: ['chat-groups'] as const,
  /** Prefix over every timezone-scoped chat list — invalidate this (not `all`)
   * from inside a feed queryFn, so refreshing the sidebar's unread
   * state can't invalidate the active query itself into a refetch loop. */
  lists: () => ['chat-groups', 'list'] as const,
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

/** Leave a group and evict every list/detail/feed view on success. */
export function useLeaveChatGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => leaveGroup(groupId),
    onSuccess: (_data, groupId) => {
      // Evict the departed group's now-unauthorized detail/feed views
      // (detail's key prefixes both) so back-nav can't render stale rows
      // while an unauthorized refetch is pending; then refresh the list.
      queryClient.cancelQueries({ queryKey: chatGroupsKeys.detail(groupId) });
      queryClient.removeQueries({ queryKey: chatGroupsKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: chatGroupsKeys.lists() });
    },
  });
}

/** Grow the group with the actor's accepted friends; refresh detail + lists. */
export function useAddGroupMembers(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberUserIds: string[]) =>
      addGroupMembers(groupId, memberUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatGroupsKeys.detail(groupId),
      });
      queryClient.invalidateQueries({ queryKey: chatGroupsKeys.lists() });
    },
  });
}

/** Owner-only: remove one member; refresh detail + lists. */
export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberUserId: string) =>
      removeGroupMember(groupId, memberUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatGroupsKeys.detail(groupId),
      });
      queryClient.invalidateQueries({ queryKey: chatGroupsKeys.lists() });
    },
  });
}

/** Owner-only rename; refresh detail (name) + lists (pill titles). */
export function useRenameGroup(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameGroup(groupId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatGroupsKeys.detail(groupId),
      });
      queryClient.invalidateQueries({ queryKey: chatGroupsKeys.lists() });
    },
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
  const queryClient = useQueryClient();
  return useInfiniteQuery<GroupMealFeedPage>({
    queryKey: chatGroupsKeys.feed(groupId),
    queryFn: async ({ pageParam }) => {
      const page = await fetchGroupMealFeed(
        groupId,
        pageParam as string | undefined
      );
      // Page 1 = the thread was just opened, which marks it read server-side
      // (see listGroupMealFeed) — refresh the sidebar so its unread/order
      // state matches. Invalidate only the list prefix, never `all`: `all`
      // prefixes this feed query, so it would invalidate itself into a loop.
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
