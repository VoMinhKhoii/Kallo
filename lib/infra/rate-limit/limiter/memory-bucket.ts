/**
 * Per-instance token bucket. A FLOOD BREAKER, never a security boundary.
 *
 * Cloud Run runs 0–20 instances with no shared state, so this bucket bounds
 * one isolate's view of one key and nothing more — an attacker spread across
 * instances walks straight past it. Its whole job is to stop a single client's
 * burst from turning into one database round trip per request; the ceiling
 * that actually holds is `rate_limit_consume`.
 */

export interface TokenBucketConfig {
  /** Maximum tokens; also the burst a cold key may spend at once. */
  capacity: number;
  refillPerSecond: number;
}

export interface MemoryBucketOptions {
  maxKeys?: number;
  sweepEvery?: number;
  /**
   * Monotonic millisecond clock. Injected so tests can advance time without
   * sleeping; production uses `performance.now()`, NOT `Date.now()` — an NTP
   * step backwards on a wall clock would otherwise make `elapsed` negative and
   * freeze a key's refill.
   */
  nowMs?: () => number;
}

interface BucketEntry {
  tokens: number;
  updatedMs: number;
  capacity: number;
  refillPerSecond: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const DEFAULT_SWEEP_EVERY = 512;

function refilled(entry: BucketEntry, nowMs: number) {
  // Clamp: even with a monotonic clock, a caller-injected one may go
  // backwards. Negative elapsed must never SUBTRACT tokens — that would let a
  // clock glitch lock a legitimate key out until its next natural refill.
  const elapsedSeconds = Math.max(0, nowMs - entry.updatedMs) / 1000;

  return Math.min(
    entry.capacity,
    entry.tokens + elapsedSeconds * entry.refillPerSecond
  );
}

export function createMemoryBucket(options: MemoryBucketOptions = {}) {
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const sweepEvery = options.sweepEvery ?? DEFAULT_SWEEP_EVERY;
  const nowMs = options.nowMs ?? (() => performance.now());
  // Map iteration order is insertion order, so "oldest entry" is just the
  // first key — which is why every hit re-inserts (delete + set) below.
  const entries = new Map<string, BucketEntry>();
  let writes = 0;

  function sweep(now: number) {
    for (const [key, entry] of entries) {
      // A fully refilled entry is indistinguishable from an absent one, so
      // dropping it is free and keeps idle keys from pinning memory.
      if (refilled(entry, now) >= entry.capacity) entries.delete(key);
    }
  }

  function evictOldest() {
    while (entries.size > maxKeys) {
      const oldest = entries.keys().next();
      if (oldest.done) return;
      entries.delete(oldest.value);
    }
  }

  return {
    /**
     * Spend one token. `false` means the key is flooding this instance.
     *
     * `atMs` overrides the injected clock for ONE call. The buckets are
     * module-level singletons created once, so without a per-call override a
     * test cannot advance time — and "does the bucket actually refill at
     * capacity/60 per second" is precisely the property a regression to the
     * old `perMinute/60` formula would break silently.
     */
    tryTake(key: string, config: TokenBucketConfig, atMs?: number): boolean {
      const now = atMs ?? nowMs();
      const existing = entries.get(key);
      let tokens = config.capacity;

      if (existing) {
        // LRU promotion: re-inserting moves the key to the end of the map, so
        // eviction always takes the least recently USED key, not the least
        // recently created one.
        entries.delete(key);
        // The CALLER's config wins over whatever was stored: a policy edit
        // must take effect on the next request, not once the key ages out.
        tokens = refilled(
          {
            ...existing,
            capacity: config.capacity,
            refillPerSecond: config.refillPerSecond,
          },
          now
        );
      }

      const allowed = tokens >= 1;
      if (allowed) tokens -= 1;

      entries.set(key, {
        tokens,
        updatedMs: now,
        capacity: config.capacity,
        refillPerSecond: config.refillPerSecond,
      });

      writes += 1;
      if (writes % sweepEvery === 0) sweep(now);
      evictOldest();

      return allowed;
    },

    /** Number of tracked keys. Test/observability affordance only. */
    size() {
      return entries.size;
    },

    reset() {
      entries.clear();
      writes = 0;
    },
  };
}

export type MemoryBucket = ReturnType<typeof createMemoryBucket>;
