'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendsKeys } from '@/hooks/social/use-friends';
import {
  fetchMyProfile,
  type PublicProfile,
  saveMyProfile,
} from '@/lib/groups/client';

export const profileKeys = {
  mine: ['my-profile'] as const,
};

/** The signed-in user's own profile (auto-provisioned, so never null). */
export function useMyProfile() {
  return useQuery<PublicProfile>({
    queryKey: profileKeys.mine,
    queryFn: fetchMyProfile,
  });
}

/** Update the user's link end (slug), then refresh anything that renders it. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { handle: string; displayName?: string | null }) =>
      saveMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.mine });
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
    },
  });
}
