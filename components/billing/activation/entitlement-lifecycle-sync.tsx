'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  clearActivationPending,
  hasActivationPending,
  recordActivationRecoveryAttempt,
} from '@/lib/domain/billing/activation/activation-pending';
import {
  createEntitlementLifecycleSync,
  type EntitlementLifecycleSync as LifecycleSync,
} from '@/lib/domain/billing/activation/entitlement-lifecycle';
import {
  applyEntitlementSnapshot,
  fetchEntitlements,
  reconcileEntitlements,
} from '@/lib/domain/billing/entitlements-client';

interface EntitlementLifecycleSyncProps {
  /** The Supabase user id — the RC appUserId grants are keyed on. */
  userId: string;
}

/**
 * Mounts the bounded entitlement recovery loop for the authenticated app.
 * Renders nothing; mounted once in the `(app)` layout so every signed-in page
 * is covered. The mobile app runs the same cadence on launch/resume.
 */
export function EntitlementLifecycleSync({
  userId,
}: EntitlementLifecycleSyncProps) {
  const queryClient = useQueryClient();
  const syncRef = useRef<LifecycleSync | null>(null);

  if (syncRef.current === null) {
    // Both fetchers assert the response identity, so a snapshot that came back
    // for a different account throws instead of landing in this user's cache.
    syncRef.current = createEntitlementLifecycleSync({
      refresh: async (id, signal) => {
        const data = await fetchEntitlements(id, signal);
        applyEntitlementSnapshot(queryClient, data);
        if (data.tier === 'premium') clearActivationPending(id);
        return data;
      },
      reconcile: async (id, signal) => {
        const data = await reconcileEntitlements(id, signal);
        applyEntitlementSnapshot(queryClient, data);
        if (data.tier === 'premium') {
          clearActivationPending(id);
        } else {
          // The provider may simply not have ingested the transaction yet, so
          // one miss must not retire the signal. Count it instead; the marker
          // retires itself once its bounded attempts are spent.
          recordActivationRecoveryAttempt(id);
        }
        return data;
      },
      // The server cannot flag a first purchase that never projected — it has
      // no grant row to derive staleness from. The local marker covers exactly
      // that hole; everything else still keys on the server's own signal.
      shouldRecover: (snapshot) =>
        snapshot.reconciliationRequired ||
        (snapshot.tier !== 'premium' && hasActivationPending(snapshot.userId)),
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
