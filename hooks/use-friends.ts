'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptFriend,
  blockFriend,
  type CircleMember,
  fetchFriends,
  requestFriend,
  searchFriendByHandle,
} from '@/lib/groups/client';
import { HANDLE_MIN_LENGTH } from '@/lib/groups/handles';

export const friendsKeys = {
  all: ['friends'] as const,
};

/** The actor's circle (accepted friends + pending requests, both directions). */
export function useFriends() {
  return useQuery<CircleMember[]>({
    queryKey: friendsKeys.all,
    queryFn: fetchFriends,
  });
}

/** Exact-match handle lookup. Enabled only when a non-empty handle is passed. */
export function useFriendSearch(handle: string) {
  const normalized = handle.trim().toLowerCase();
  return useQuery({
    queryKey: ['friend-search', normalized],
    queryFn: () => searchFriendByHandle(normalized),
    enabled: normalized.length >= HANDLE_MIN_LENGTH,
  });
}

export function useRequestFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => requestFriend(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}

export function useAcceptFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: string) => acceptFriend(friendshipId),
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
