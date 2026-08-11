import type { EntitlementsResponse } from '@/hooks/billing/use-entitlements';

// Web port of `apps/mobile-flutter/lib/data/billing/entitlement_lifecycle_sync.dart`.
// Keep the two in step: both implement the cadence documented in docs/BILLING.md.
//
// Signed webhooks remain the primary update path. This is the bounded recovery
// path for the cases a webhook never lands — a delayed or dropped renewal, a
// refund processed while the tab was closed, a purchase that completed after
// the paywall's activation poll gave up. It reads the cheap server snapshot
// first and only spends provider budget (and the reconcile endpoint's 3/min,
// 20/hr, 100/day per-user guard) when the server itself reports
// `reconciliationRequired`.

const MINIMUM_INTERVAL_MS = 15 * 60 * 1000;
const OPERATION_TIMEOUT_MS = 65 * 1000;

export interface EntitlementLifecycleSyncDeps {
  /** Cheap local read — GET /api/v1/account/entitlements. */
  refresh: (
    userId: string,
    signal: AbortSignal
  ) => Promise<EntitlementsResponse>;
  /** Provider-backed recovery — POST /api/v1/account/entitlements/reconcile. */
  reconcile: (
    userId: string,
    signal: AbortSignal
  ) => Promise<EntitlementsResponse>;
  /**
   * Whether the cheap snapshot warrants spending provider budget. Defaults to
   * the server's own `reconciliationRequired`, which is derived from existing
   * grant rows and so cannot see a first purchase that never projected —
   * callers override this to add that case.
   */
  shouldRecover?: (snapshot: EntitlementsResponse) => boolean;
  now?: () => number;
  minimumIntervalMs?: number;
  operationTimeoutMs?: number;
}

export interface EntitlementLifecycleSync {
  /**
   * Runs once per mount/account, then at most once per `minimumIntervalMs` on
   * subsequent lifecycle signals (tab visibility regained).
   *
   * Failures are deliberately swallowed: entitlement access is
   * server-authoritative, so a failed refresh must never take down the
   * authenticated app shell. The attempt still consumes the interval so a
   * failing endpoint is not retried on every focus change.
   */
  synchronize: (userId: string) => Promise<void>;
}

export function createEntitlementLifecycleSync(
  deps: EntitlementLifecycleSyncDeps
): EntitlementLifecycleSync {
  const {
    refresh,
    reconcile,
    shouldRecover = (snapshot) => snapshot.reconciliationRequired,
    now = () => Date.now(),
    minimumIntervalMs = MINIMUM_INTERVAL_MS,
    operationTimeoutMs = OPERATION_TIMEOUT_MS,
  } = deps;

  let ownerUserId: string | null = null;
  let lastAttemptAt: number | null = null;
  let inFlight: Promise<void> | null = null;
  let inFlightController: AbortController | null = null;
  let generation = 0;

  async function run(userId: string, ownedGeneration: number): Promise<void> {
    const controller = new AbortController();
    inFlightController = controller;
    // Bounds the whole operation, not each request: a hung refresh must not
    // leave the follow-up reconcile running past the caller's expectations.
    const timer = setTimeout(() => controller.abort(), operationTimeoutMs);
    const stillOwned = () =>
      generation === ownedGeneration && ownerUserId === userId;

    try {
      const snapshot = await refresh(userId, controller.signal);
      if (!stillOwned() || !shouldRecover(snapshot)) return;
      await reconcile(userId, controller.signal);
    } catch (error) {
      // Swallowed by design — see `synchronize`. Logged rather than silent:
      // this loop is the only thing that heals a missed webhook, so a failure
      // that repeats is worth seeing in a session replay or a bug report.
      console.warn('[billing] entitlement lifecycle sync failed', error);
    } finally {
      clearTimeout(timer);
      if (inFlightController === controller) inFlightController = null;
      if (stillOwned()) inFlight = null;
    }
  }

  return {
    synchronize(userId: string): Promise<void> {
      if (ownerUserId !== userId) {
        // An account switch invalidates work bound to the previous user: abort
        // the request and bump the generation so its completion is ignored.
        inFlightController?.abort();
        inFlightController = null;
        ownerUserId = userId;
        lastAttemptAt = null;
        inFlight = null;
        generation += 1;
      }

      const active = inFlight;
      if (active) return active;

      const startedAt = now();
      if (lastAttemptAt !== null) {
        const elapsed = startedAt - lastAttemptAt;
        if (elapsed >= 0 && elapsed < minimumIntervalMs) {
          return Promise.resolve();
        }
      }

      lastAttemptAt = startedAt;
      const operation = run(userId, generation);
      inFlight = operation;
      return operation;
    },
  };
}
