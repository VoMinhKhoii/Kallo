'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  entitlementsKeys,
  fetchEntitlements,
  reconcileEntitlements,
} from '@/hooks/billing/use-entitlements';
import {
  createEntitlementLifecycleSync,
  type EntitlementLifecycleSync as LifecycleSync,
} from './entitlement-lifecycle';

/**
 * Mounts the bounded entitlement recovery loop for the authenticated app.
 * Renders nothing; mounted once in the `(app)` layout so every signed-in page
 * is covered. The mobile app runs the same cadence on launch/resume.
 */
export function EntitlementLifecycleSync({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const syncRef = useRef<LifecycleSync | null>(null);

  if (syncRef.current === null) {
    // Both fetchers assert the response identity, so a snapshot that came back
    // for a different account throws instead of landing in this user's cache.
    syncRef.current = createEntitlementLifecycleSync({
      refresh: async (id, signal) => {
        const data = await fetchEntitlements(id, signal);
        queryClient.setQueryData(entitlementsKeys.user(id), data);
        return data;
      },
      reconcile: async (id, signal) => {
        const data = await reconcileEntitlements(id, signal);
        queryClient.setQueryData(entitlementsKeys.user(id), data);
        return data;
      },
    });
  }

  useEffect(() => {
    const sync = syncRef.current;
    if (!sync) return;

    void sync.synchronize(userId);

    // Tab visibility is the web analogue of a mobile app resume.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sync.synchronize(userId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  return null;
}
