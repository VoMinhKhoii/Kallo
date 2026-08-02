// A purchase completed at the provider but the server has not projected a
// grant yet. Recorded per user so the entitlement lifecycle sync can force one
// provider recovery on a later visit.
//
// This exists because the server cannot infer the state. `reconciliationRequired`
// is derived from existing grant rows (see `lib/entitlements/service.ts`), so a
// user whose FIRST purchase never projected has no rows, no winning grant, and
// therefore no signal at all — the one failure the automatic recovery path
// cannot see. Normally the signed webhook writes that grant within seconds; if
// it is lost or dead-lettered, this marker is what stops a paying customer
// sitting on the free tier indefinitely.
//
// Deliberately client-side and best-effort: it only ever causes ONE extra
// authenticated reconcile, never grants access. Access stays server-owned.

const KEY_PREFIX = 'kallo.billing.activationPending.';
// Long enough to survive a provider outage or a dead-lettered webhook that is
// replayed the next day; short enough that an abandoned marker cannot keep
// spending reconcile budget forever.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Safari private mode and similar throw on access rather than returning null.
    return null;
  }
}

export function markActivationPending(userId: string, now = Date.now()): void {
  try {
    storage()?.setItem(KEY_PREFIX + userId, String(now));
  } catch {
    // Quota or disabled storage — recovery degrades to the webhook.
  }
}

export function clearActivationPending(userId: string): void {
  try {
    storage()?.removeItem(KEY_PREFIX + userId);
  } catch {
    // Ignored; a stale marker expires on its own.
  }
}

/** True while a recent purchase is still unaccounted for by the server. */
export function hasActivationPending(
  userId: string,
  now = Date.now()
): boolean {
  try {
    const raw = storage()?.getItem(KEY_PREFIX + userId);
    if (!raw) return false;
    const markedAt = Number(raw);
    if (!Number.isFinite(markedAt) || now - markedAt >= MAX_AGE_MS) {
      clearActivationPending(userId);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
