'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    },
  });
}

export function useBlockFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => blockFriend(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}
