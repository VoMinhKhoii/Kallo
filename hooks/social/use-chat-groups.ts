'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ChatGroupDetail,
  type ChatGroupIdentity,
  createChatGroup,
  fetchChatGroup,
  fetchGroupMealFeed,
  fetchMyChatGroups,
  type GroupMealFeedEntry,
} from '@/lib/chat-groups/client';

/** Poll interval (ms) for a group's meal feed — same cadence as useCircleFeed. */
const GROUP_FEED_POLL_INTERVAL_MS = 30_000;

export const chatGroupsKeys = {
  all: ['chat-groups'] as const,
  detail: (groupId: string) => ['chat-groups', groupId] as const,
  feed: (groupId: string, timezoneOffset: number) =>
    ['chat-groups', groupId, 'feed', timezoneOffset] as const,
};

/** Every chat (direct + group) the actor belongs to. */
export function useMyChatGroups() {
  return useQuery<ChatGroupIdentity[]>({
    queryKey: chatGroupsKeys.all,
    queryFn: fetchMyChatGroups,
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

/** This group's members' most-recent shared meal today. */
export function useGroupMealFeed(groupId: string) {
  const timezoneOffset = new Date().getTimezoneOffset();
  return useQuery<GroupMealFeedEntry[]>({
    queryKey: chatGroupsKeys.feed(groupId, timezoneOffset),
    queryFn: () => fetchGroupMealFeed(groupId, timezoneOffset),
    refetchInterval: GROUP_FEED_POLL_INTERVAL_MS,
  });
}
