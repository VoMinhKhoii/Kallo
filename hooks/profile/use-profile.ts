'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendsKeys } from '@/hooks/social/use-friends';
import type { PublicProfile } from '@/lib/actions/groups/types';
import {
  fetchMyProfile,
  removeMyAvatar,
  renameMyProfile,
  saveMyProfile,
  uploadMyAvatar,
} from '@/lib/domain/social/circle-client';

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

/** Shared onSuccess: refresh everything that renders the identity. */
function useInvalidateIdentity() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: profileKeys.mine });
    queryClient.invalidateQueries({ queryKey: friendsKeys.all });
  };
}

/** Update the user's link end (slug), then refresh anything that renders it. */
export function useSaveProfile() {
  const onSuccess = useInvalidateIdentity();
  return useMutation({
    mutationFn: (input: { handle: string; displayName?: string | null }) =>
      saveMyProfile(input),
    onSuccess,
  });
}

/** Rename ("what should we call you") — the handle cascades server-side. */
export function useRenameProfile() {
  const onSuccess = useInvalidateIdentity();
  return useMutation({
    mutationFn: (displayName: string) => renameMyProfile(displayName),
    onSuccess,
  });
}

export function useUploadAvatar() {
  const onSuccess = useInvalidateIdentity();
  return useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess,
  });
}

export function useRemoveAvatar() {
  const onSuccess = useInvalidateIdentity();
  return useMutation({
    mutationFn: () => removeMyAvatar(),
    onSuccess,
  });
}
