'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMyProfile,
  type PublicProfile,
  saveMyProfile,
} from '@/lib/groups/client';
import { friendsKeys } from './use-friends';

export const profileKeys = {
  mine: ['my-profile'] as const,
};

/** The signed-in user's own public profile (handle), or null if unclaimed. */
export function useMyProfile() {
  return useQuery<PublicProfile | null>({
    queryKey: profileKeys.mine,
    queryFn: fetchMyProfile,
  });
}

/** Claim or update the user's handle, then refresh anything that renders it. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { handle: string; displayName?: string }) =>
      saveMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.mine });
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}
