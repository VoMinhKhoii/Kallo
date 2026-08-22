import type { QueryClient } from '@tanstack/react-query';
import {
  entitlementsKeys,
  fetchEntitlements,
  reconcileEntitlements,
} from '@/lib/domain/billing/entitlements-client';

// Webhook-race polling: after a successful checkout the client is ahead of the
// server, which only learns of the grant when RC's webhook lands. Poll the
// entitlements query on a 2s cadence until the tier flips or the window closes.
//
// The window is an absolute wall-clock deadline, and every request carries a
// budget clamped to what is left of it. Attempt counting alone is not a bound:
// one hung request can outlive the whole window and leave the paywall spinning
// long after the user expects an answer.
const POLL_INTERVAL_MS = 2000;
const POLL_DEADLINE_MS = 30_000;

/** Run `operation` with an abort budget of `ms`, cleaning the timer up after. */
async function withBudget<T>(
  ms: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export async function pollUntilPremium(
  queryClient: QueryClient,
  userId: string,
  isCurrent: () => boolean = () => true
): Promise<boolean> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  const remaining = () => deadline - Date.now();

  const reconcileOnce = async (): Promise<boolean> => {
    try {
      const reconciled = await withBudget(remaining(), (signal) =>
        reconcileEntitlements(userId, signal)
      );
      if (!isCurrent()) return false;
      queryClient.setQueryData(entitlementsKeys.user(userId), reconciled);
      return reconciled.tier === 'premium';
    } catch {
      // A webhook may still land even if the explicit recovery request failed.
      return false;
    }
  };

  // Recovery is provider-backed at most twice; everything between is a cheap
  // local read while the signed webhook catches up. Do not hammer RevenueCat
  // every two seconds from each browser.
  if (!isCurrent()) return false;
  if (await reconcileOnce()) return true;

  // The first reconcile fires the instant checkout resolves, which is the
  // moment the provider is LEAST likely to have recorded the purchase — an
  // observed sandbox purchase landed ~5s after the reconcile that preceded it,
  // leaving that call to find nothing and the rest of the window to re-read a
  // database nobody had written to. Spend one more provider call before giving
  // up, so activation does not depend on the webhook winning a race.
  let retried = false;
  const retryAt = POLL_DEADLINE_MS / 2;
  // Never spend the retry on a sliver of window it cannot use: if the first
  // reconcile ate most of the budget there is no point paying for a second call
  // whose response cannot arrive in time.
  const retryFloor = POLL_DEADLINE_MS / 4;

  while (remaining() > 0) {
    if (!isCurrent()) return false;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(POLL_INTERVAL_MS, remaining()))
    );
    if (!isCurrent() || remaining() <= 0) return false;

    if (!retried && remaining() <= retryAt && remaining() >= retryFloor) {
      retried = true;
      if (await reconcileOnce()) return true;
      if (!isCurrent()) return false;
      continue;
    }

    try {
      // Imperative fetch so the read does not depend on an active observer.
      const data = await withBudget(remaining(), (signal) =>
        fetchEntitlements(userId, signal)
      );
      // Recheck before caching, exactly as reconcileOnce does. A fetch started
      // before the user opened a second checkout can resolve after that
      // purchase already cached `premium`, and writing this older snapshot over
      // it would drop a paid user back to free in the UI.
      if (!isCurrent()) return false;
      queryClient.setQueryData(entitlementsKeys.user(userId), data);
      if (data.tier === 'premium') return true;
    } catch {
      // Transient failure — the last good snapshot stays cached, and polling
      // continues until the window elapses.
    }
  }
  return false;
}
