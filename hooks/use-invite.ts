'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { circleFeedKeys } from '@/hooks/use-circle-feed';
import { friendsKeys } from '@/hooks/use-friends';
import { acceptInvite } from '@/lib/groups/client';

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
