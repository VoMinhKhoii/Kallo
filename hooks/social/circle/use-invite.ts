'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvite } from '@/lib/domain/social/circle-client';
import { circleFeedKeys, friendsKeys } from '@/lib/domain/social/query-keys';

/**
 * Accept a link invite (the recipient's tap connects them to the inviter).
 * Refreshes the circle list + the ambient feed on success.
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => acceptInvite(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsKeys.all });
      queryClient.invalidateQueries({ queryKey: circleFeedKeys.all });
    },
  });
}
