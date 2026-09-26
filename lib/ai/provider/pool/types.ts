/**
 * Types and contracts for in-process AI key rotation and quarantine tracking.
 */

export type KeyStatus = 'active' | 'quarantined' | 'revoked';

export interface KeyRecord {
  key: string;
  status: KeyStatus;
  cooldownUntil: number;
  consecutiveFailures: number;
  lastFailureReason?: string;
  totalRequests: number;
}

export interface KeyPoolConfig {
  /** Quarantine duration in milliseconds for transient 429 quota exhaustion. Default: 60,000 ms. */
  cooldownMs?: number;
  /** Injectable time source for deterministic testing without fake timers. */
  now?: () => number;
}

export interface KeyPoolSnapshot {
  totalKeys: number;
  activeKeys: number;
  quarantinedKeys: number;
  revokedKeys: number;
  /** If all keys are quarantined, milliseconds remaining until the earliest key recovers. */
  nextAvailableInMs: number | null;
}

export interface AcquiredKey {
  key: string;
  index: number;
}

export interface KeyPool {
  /**
   * Acquire the next healthy key in round-robin sequence.
   * Automatically recovers expired quarantined keys.
   * Returns null if all keys are currently quarantined or revoked.
   */
  acquireKey(): AcquiredKey | null;

  /** Mark a key as temporarily quarantined (e.g. 429 Quota Exceeded). */
  markQuarantine(key: string, reason?: string, customDurationMs?: number): void;

  /** Mark a key as permanently revoked (e.g. 401 Unauthorized / 403 Forbidden). */
  markRevoked(key: string, reason?: string): void;

  /** Record a successful request for this key, resetting consecutive failure counter. */
  markSuccess(key: string): void;

  /** Read current pool health snapshot for telemetry and routing decisions. */
  getSnapshot(): KeyPoolSnapshot;

  /** Number of total configured keys in the pool. */
  size(): number;
}
