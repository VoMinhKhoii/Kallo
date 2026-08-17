'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CircleMember } from '@/lib/actions/groups/types';
import {
  blockFriend,
  fetchFriends,
  removeFriend,
} from '@/lib/domain/social/circle-client';
import { circleFeedKeys, friendsKeys } from '@/lib/domain/social/query-keys';

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

export function useBlockFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => blockFriend(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
      // Drop the blocked friend's meals from the ambient wall, too.
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}
