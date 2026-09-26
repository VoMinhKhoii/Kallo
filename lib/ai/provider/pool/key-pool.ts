import type {
  AcquiredKey,
  KeyPool,
  KeyPoolConfig,
  KeyPoolSnapshot,
  KeyRecord,
} from './types';

const DEFAULT_COOLDOWN_MS = 60_000; // 60 seconds

/**
 * Sanitizes and splits comma-separated or array keys into a clean, unique string array.
 * Trims whitespace, removes empty tokens, and dedupes entries.
 */
export function parseKeyList(
  raw: string | string[] | undefined | null
): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : raw.split(',');
  const cleaned = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(cleaned));
}

export function createKeyPool(
  rawKeys: string | string[],
  config: KeyPoolConfig = {}
): KeyPool {
  const keys = parseKeyList(rawKeys);
  const cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = config.now ?? (() => Date.now());

  const records: KeyRecord[] = keys.map((key) => ({
    key,
    status: 'active',
    cooldownUntil: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
  }));

  const recordMap = new Map<string, KeyRecord>();
  for (const r of records) {
    recordMap.set(r.key, r);
  }

  let currentIndex = 0;

  function acquireKey(): AcquiredKey | null {
    if (records.length === 0) return null;

    const currentTime = now();
    const count = records.length;

    // Scan up to count times starting from currentIndex
    for (let offset = 0; offset < count; offset++) {
      const idx = (currentIndex + offset) % count;
      const candidate = records[idx];

      // If permanently revoked, skip immediately
      if (candidate.status === 'revoked') {
        continue;
      }

      // If quarantined, check if the cooldown has elapsed
      if (candidate.status === 'quarantined') {
        if (currentTime >= candidate.cooldownUntil) {
          // Recover key to active
          candidate.status = 'active';
          candidate.cooldownUntil = 0;
          currentIndex = (idx + 1) % count;
          candidate.totalRequests++;
          return { key: candidate.key, index: idx };
        }
        // Still cooling down, continue checking other keys
        continue;
      }

      // Key is active
      currentIndex = (idx + 1) % count;
      candidate.totalRequests++;
      return { key: candidate.key, index: idx };
    }

    // All keys are either cooling down or revoked
    return null;
  }

  function markQuarantine(
    key: string,
    reason = '429 Quota Exceeded',
    customDurationMs?: number
  ): void {
    const record = recordMap.get(key);
    if (!record || record.status === 'revoked') return;

    const duration = customDurationMs ?? cooldownMs;
    record.status = 'quarantined';
    record.cooldownUntil = now() + duration;
    record.consecutiveFailures++;
    record.lastFailureReason = reason;
  }

  function markRevoked(
    key: string,
    reason = 'Invalid API key or unauthorized'
  ): void {
    const record = recordMap.get(key);
    if (!record) return;

    record.status = 'revoked';
    record.cooldownUntil = Number.POSITIVE_INFINITY;
    record.consecutiveFailures++;
    record.lastFailureReason = reason;
  }

  function markSuccess(key: string): void {
    const record = recordMap.get(key);
    if (!record) return;

    if (record.status === 'quarantined') {
      record.status = 'active';
      record.cooldownUntil = 0;
    }
    record.consecutiveFailures = 0;
  }

  function getSnapshot(): KeyPoolSnapshot {
    const currentTime = now();
    let activeKeys = 0;
    let quarantinedKeys = 0;
    let revokedKeys = 0;
    let earliestAvailableAt = Number.POSITIVE_INFINITY;

    for (const r of records) {
      if (r.status === 'revoked') {
        revokedKeys++;
      } else if (r.status === 'quarantined' && currentTime < r.cooldownUntil) {
        quarantinedKeys++;
        if (r.cooldownUntil < earliestAvailableAt) {
          earliestAvailableAt = r.cooldownUntil;
        }
      } else {
        activeKeys++;
      }
    }

    const nextAvailableInMs =
      activeKeys > 0 || earliestAvailableAt === Number.POSITIVE_INFINITY
        ? null
        : Math.max(0, earliestAvailableAt - currentTime);

    return {
      totalKeys: records.length,
      activeKeys,
      quarantinedKeys,
      revokedKeys,
      nextAvailableInMs,
    };
  }

  return {
    acquireKey,
    markQuarantine,
    markRevoked,
    markSuccess,
    getSnapshot,
    size: () => records.length,
  };
}
