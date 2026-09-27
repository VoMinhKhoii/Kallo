'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CircleMember } from '@/lib/actions/groups/types';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';
import {
  blockFriend,
  fetchFriends,
  removeFriend,
} from '@/lib/domain/social/circle-client';
import {
  chatGroupsKeys,
  circleFeedKeys,
  friendsKeys,
  friendsThreadFeedKeys,
  shareThreadKeys,
} from '@/lib/domain/social/query-keys';

/** The actor's circle (accepted friends). `enabled` lets callers defer the
 *  fetch until needed (e.g. a dialog only queries once opened). */
export function useFriends(options?: { enabled?: boolean }) {
  return useQuery<CircleMember[]>({
    queryKey: friendsKeys.all,
    queryFn: fetchFriends,
    enabled: options?.enabled ?? true,
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => removeFriend(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
      // Drop the removed friend's meals from the ambient wall, too.
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}

const BLOCK_AFFECTED_KEYS = [
  friendsKeys.all,
  circleFeedKeys.all,
  friendsThreadFeedKeys.all,
  shareThreadKeys.all,
  chatGroupsKeys.all,
  notificationKeys.all,
] as const;

export function useBlockFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => blockFriend(targetUserId),
    onSuccess: () => {
      // A block cuts the pair off everywhere at once — the friendship, every
      // shared feed and chat, share pages and their notifications — so each
      // cached surface that could still show the blocked person is refetched.
      for (const queryKey of BLOCK_AFFECTED_KEYS) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
