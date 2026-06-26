export interface ShadowGuardClock {
  now: () => number;
}

export interface ShadowGuardConfig {
  clock?: ShadowGuardClock;
  primaryP95Ms?: () => number | null;
  primaryP95ThresholdMs?: number;
  dbPoolWaitMs?: () => number | null;
  dbPoolWaitThresholdMs?: number;
  embeddingRateLimited?: () => boolean;
  nonessentialGuard?: () => Promise<NonessentialShadowGuardDecision>;
}

export type NonessentialShadowGuardDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: 'shadow_quota' | 'global_budget' | 'provider_pressure';
      retryAfterSeconds: number;
    };

export type ShadowGuardAbortReason =
  | 'aborted_primary_p95'
  | 'aborted_pool_wait'
  | 'aborted_embed_rate_limit'
  | 'aborted_shadow_quota'
  | 'aborted_global_budget'
  | 'aborted_provider_pressure';

export type ShadowGuardDecision =
  | { run: true }
  | {
      run: false;
      reason: ShadowGuardAbortReason;
    };

export interface PrimaryLatencyTracker {
  record: (durationMs: number) => void;
  p95Ms: () => number | null;
}

const DEFAULT_CLOCK: ShadowGuardClock = { now: () => Date.now() };
const PRIMARY_P95_COOLDOWN_MS = 30 * 60_000;
const DEFAULT_PRIMARY_LATENCY_WINDOW_MS = 5 * 60_000;
const EMBEDDING_RATE_LIMIT_WINDOW_MS = 60_000;
const nonessentialAbortReasons = {
  shadow_quota: 'aborted_shadow_quota',
  global_budget: 'aborted_global_budget',
  provider_pressure: 'aborted_provider_pressure',
} as const satisfies Record<
  Exclude<NonessentialShadowGuardDecision, { allowed: true }>['reason'],
  ShadowGuardAbortReason
>;

export function createPrimaryLatencyTracker(
  cfg: { clock?: ShadowGuardClock; windowMs?: number } = {}
): PrimaryLatencyTracker {
  const clock = cfg.clock ?? DEFAULT_CLOCK;
  const windowMs = cfg.windowMs ?? DEFAULT_PRIMARY_LATENCY_WINDOW_MS;
  const samples: Array<{ at: number; durationMs: number }> = [];

  function prune(now: number): void {
    while (samples.length > 0 && now - samples[0].at > windowMs) {
      samples.shift();
    }
  }

  return {
    record(durationMs) {
      const now = clock.now();
      samples.push({ at: now, durationMs });
      prune(now);
    },
    p95Ms() {
      const now = clock.now();
      prune(now);
      if (samples.length === 0) {
        return null;
      }
      const sorted = samples.map((s) => s.durationMs).toSorted((a, b) => a - b);
      const index = Math.ceil(sorted.length * 0.95) - 1;
      return sorted[Math.max(0, index)];
    },
  };
}

const primaryLatencyTracker = createPrimaryLatencyTracker();
let lastEmbeddingRateLimitAt: number | null = null;

export function recordPrimaryDuration(durationMs: number): void {
  primaryLatencyTracker.record(durationMs);
}

export function getPrimaryP95Ms(): number | null {
  return primaryLatencyTracker.p95Ms();
}

export function setEmbeddingRateLimited(rateLimited: boolean): void {
  lastEmbeddingRateLimitAt = rateLimited ? DEFAULT_CLOCK.now() : null;
}

export function isEmbeddingRateLimited(): boolean {
  if (lastEmbeddingRateLimitAt === null) {
    return false;
  }

  const elapsed = DEFAULT_CLOCK.now() - lastEmbeddingRateLimitAt;
  if (elapsed > EMBEDDING_RATE_LIMIT_WINDOW_MS) {
    lastEmbeddingRateLimitAt = null;
    return false;
  }

  return true;
}

export function createShadowGuard(cfg: ShadowGuardConfig = {}) {
  const clock = cfg.clock ?? DEFAULT_CLOCK;
  let primaryP95LockUntil = 0;

  async function shouldRun(): Promise<ShadowGuardDecision> {
    const now = clock.now();

    if (now < primaryP95LockUntil) {
      return { run: false, reason: 'aborted_primary_p95' };
    }

    const p95 = cfg.primaryP95Ms?.();
    if (
      typeof p95 === 'number' &&
      typeof cfg.primaryP95ThresholdMs === 'number' &&
      p95 > cfg.primaryP95ThresholdMs
    ) {
      primaryP95LockUntil = now + PRIMARY_P95_COOLDOWN_MS;
      return { run: false, reason: 'aborted_primary_p95' };
    }

    const poolWait = cfg.dbPoolWaitMs?.();
    if (
      typeof poolWait === 'number' &&
      typeof cfg.dbPoolWaitThresholdMs === 'number' &&
      poolWait > cfg.dbPoolWaitThresholdMs
    ) {
      return { run: false, reason: 'aborted_pool_wait' };
    }

    if (cfg.embeddingRateLimited?.()) {
      return { run: false, reason: 'aborted_embed_rate_limit' };
    }

    const nonessentialDecision = await cfg.nonessentialGuard?.();
    if (nonessentialDecision && !nonessentialDecision.allowed) {
      return {
        run: false,
        reason: nonessentialAbortReasons[nonessentialDecision.reason],
      };
    }

    return { run: true };
  }

  function onPrimaryComplete(primaryMs: number): void {
    recordPrimaryDuration(primaryMs);
  }

  return { shouldRun, onPrimaryComplete };
}
