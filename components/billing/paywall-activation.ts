import type { QueryClient } from '@tanstack/react-query';
import {
  entitlementsKeys,
  fetchEntitlements,
  reconcileEntitlements,
} from '@/hooks/billing/use-entitlements';

// Webhook-race polling: after a successful checkout the client is ahead of the
// server, which only learns of the grant when RC's webhook lands. Poll the
// entitlements query on a fixed 2s cadence for up to ~30s until tier flips.
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15;

export async function pollUntilPremium(
  queryClient: QueryClient,
  userId: string,
  isCurrent: () => boolean = () => true
): Promise<boolean> {
  // Recovery is provider-backed once. The remaining checks are cheap local DB
  // reads while the signed webhook catches up; do not hammer RevenueCat every
  // two seconds from each browser.
  try {
    if (!isCurrent()) return false;
    const reconciled = await reconcileEntitlements(userId);
    if (!isCurrent()) return false;
    queryClient.setQueryData(entitlementsKeys.user(userId), reconciled);
    if (reconciled.tier === 'premium') return true;
  } catch {
    // A webhook may still land even if the explicit recovery request failed.
  }

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    if (!isCurrent()) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (!isCurrent()) return false;
    try {
      // Imperative fetch so the read does not depend on an active observer.
      const data = await fetchEntitlements(userId);
      queryClient.setQueryData(entitlementsKeys.user(userId), data);
      if (data.tier === 'premium') return true;
    } catch {
      // Transient fetch failure — keep polling until the window elapses.
    }
  }
  return false;
}
