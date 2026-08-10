// A purchase may have completed at the provider while the server has not
// projected a grant. Recorded per user so the entitlement lifecycle sync can
// force provider recovery on a later visit.
//
// This exists because the server cannot infer the state. `reconciliationRequired`
// is derived from existing grant rows (see `lib/entitlements/service.ts`), so a
// user whose FIRST purchase never projected has no rows, no winning grant, and
// therefore no signal at all — the one failure the automatic recovery path
// cannot see. Normally the signed webhook writes that grant within seconds; if
// it is lost or dead-lettered, this marker is what stops a paying customer
// sitting on the free tier.
//
// Two properties matter, and both were wrong in the first cut:
//
//  - It is written BEFORE checkout opens, not after the SDK promise resolves.
//    The likeliest interruption is the user paying and then closing the tab,
//    which never resolves that promise. A marker written afterwards would be
//    missing in exactly the case it exists for. The cost of marking early is
//    one wasted reconcile if the user abandons checkout without cancelling.
//
//  - One recovery attempt is not enough to clear it. The provider can still be
//    lagging when recovery runs, so clearing on attempt throws away the signal
//    while the user is still unpaid-for. It is instead retried a bounded number
//    of times, because "retry until premium" against a 15-minute lifecycle
//    cadence would approach the reconcile endpoint's 100/day per-user ceiling.
//
// Deliberately client-side and best-effort: it only ever causes an extra
// authenticated reconcile, never grants access. Access stays server-owned.

const KEY_PREFIX = 'kallo.billing.activationPending.';
// Long enough to survive a provider outage or a dead-lettered webhook replayed
// the next day; short enough that an abandoned marker cannot linger.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Bounded so a permanently unprojectable purchase cannot spend reconcile budget
// indefinitely. Three attempts across a >=15-minute cadence comfortably outlives
// a lagging provider while staying far below 20/hr and 100/day.
const MAX_RECOVERY_ATTEMPTS = 3;

interface PendingRecord {
  at: number;
  attempts: number;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Safari private mode and similar throw on access rather than returning null.
    return null;
  }
}

function read(userId: string): PendingRecord | null {
  try {
    const raw = storage()?.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    // Tolerate the earlier bare-timestamp format so an in-flight activation
    // from a previous deploy is not silently dropped on upgrade.
    const parsed: unknown = raw.startsWith('{') ? JSON.parse(raw) : Number(raw);
    if (typeof parsed === 'number') {
      return Number.isFinite(parsed) ? { at: parsed, attempts: 0 } : null;
    }
    if (parsed && typeof parsed === 'object') {
      const { at, attempts } = parsed as Partial<PendingRecord>;
      if (typeof at === 'number' && Number.isFinite(at)) {
        return { at, attempts: typeof attempts === 'number' ? attempts : 0 };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function write(userId: string, record: PendingRecord): void {
  try {
    storage()?.setItem(KEY_PREFIX + userId, JSON.stringify(record));
  } catch {
    // Quota or disabled storage — recovery degrades to the webhook.
  }
}

/**
 * Record that a checkout is being opened. Call this BEFORE handing control to
 * the provider, not after it returns.
 */
export function markActivationPending(userId: string, now = Date.now()): void {
  write(userId, { at: now, attempts: 0 });
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
  const record = read(userId);
  if (!record) return false;
  if (now - record.at >= MAX_AGE_MS) {
    clearActivationPending(userId);
    return false;
  }
  if (record.attempts >= MAX_RECOVERY_ATTEMPTS) {
    clearActivationPending(userId);
    return false;
  }
  return true;
}

/**
 * Count one provider recovery that did NOT yield premium. Retires the marker
 * once the attempt budget is spent, so an unprojectable purchase cannot keep
 * spending reconcile budget for a day.
 */
export function recordActivationRecoveryAttempt(userId: string): void {
  const record = read(userId);
  if (!record) return;
  const attempts = record.attempts + 1;
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    clearActivationPending(userId);
    return;
  }
  write(userId, { at: record.at, attempts });
}
