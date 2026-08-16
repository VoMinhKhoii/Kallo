'use client';

import { useMutation } from '@tanstack/react-query';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { parseApiError } from '@/lib/errors/client';

/**
 * Submit an address to the landing-page waitlist.
 *
 * No cache to invalidate — the endpoint is write-only and, by design, tells us
 * nothing about the list's contents.
 */
export function useWaitlistSignup() {
  return useMutation({
    mutationFn: async (input: WaitlistSignupInput) => {
      const response = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw parseApiError(await response.json().catch(() => null));
      }
    },
  });
}
