/**
 * The generic L4 primitive: a bounded, TTL-expiring, LRU in-memory cache.
 *
 * Knows nothing about what it stores — the key derivation lives with each
 * caller (see `lib/ai/pipeline/legacy/decomposition-cache.ts` for the v1
 * decomposition key). `now` is injectable so TTL behaviour is testable
 * without fake timers.
 *
 * Its only consumer today is the v1 decomposition stage behind
 * `PIPELINE_V2_ENABLED=false`. It lives here rather than in `legacy/` because
 * it is a general primitive with no v1 knowledge; if the flag is ever retired,
 * this file goes with `legacy/` unless a v2 caller has claimed it by then.
 */

export interface L4Cache<V> {
  get: (key: string) => V | null;
  set: (key: string, value: V) => void;
  size: () => number;
  clear: () => void;
}

export interface L4CacheConfig {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export function createL4Cache<V>(cfg: L4CacheConfig): L4Cache<V> {
  const now = cfg.now ?? (() => Date.now());
  const map = new Map<string, Entry<V>>();

  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) {
        return null;
      }
      if (entry.expiresAt <= now()) {
        map.delete(key);
        return null;
      }

      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      }
      map.set(key, { value, expiresAt: now() + cfg.ttlMs });
      while (map.size > cfg.maxEntries) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        map.delete(oldest);
      }
    },
    size: () => map.size,
    clear: () => map.clear(),
  };
}
