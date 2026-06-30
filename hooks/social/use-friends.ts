'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { circleFeedKeys } from '@/hooks/social/use-circle-feed';
import {
  blockFriend,
  type CircleMember,
  fetchFriends,
  removeFriend,
} from '@/lib/groups/client';

export const friendsKeys = {
  all: ['friends'] as const,
};

/** The actor's circle (accepted friends). */
export function useFriends() {
  return useQuery<CircleMember[]>({
    queryKey: friendsKeys.all,
    queryFn: fetchFriends,
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
