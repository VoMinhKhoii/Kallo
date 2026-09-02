/**
 * The per-instance buckets, and what the limiter does when Postgres cannot
 * answer.
 *
 * Split out of `consume.ts` because it is a separate question: `consume.ts`
 * owns the ORDER of the checks (which keys, cheapest first, short-circuit on
 * block), while this file owns the DEGRADED semantics — how a bucket is sized,
 * what a `failMode: 'memory'` policy enforces, and what a `'degraded'` policy
 * falls back to during an outage.
 */

import type { recordRateLimitEvent } from './events';
import { createMemoryBucket, type TokenBucketConfig } from './memory-bucket';
import type {
  RateLimitKeyKind,
  RateLimitPolicy,
  RateLimitResult,
  RateLimitSource,
} from './types';

const DEFAULT_BURST_FACTOR = 3;

// Burst breaker in front of the DB (capacity = perMinute x burstFactor).
const burstBucket = createMemoryBucket();
// Raw per-minute enforcement: `failMode: 'memory'` policies, and the fallback
// a `'degraded'` policy drops to while the DB is unreachable. No burst — this
// one IS the ceiling, not a pre-check in front of one.
const hardBucket = createMemoryBucket();

/** Everything a single key's check needs to know about itself. */
export interface KeyContext {
  policy: RateLimitPolicy;
  keyKind: RateLimitKeyKind;
  keyHash: string;
  bucketKey: string;
  recordEvent: typeof recordRateLimitEvent;
  /** Test clock seam; production leaves it undefined. */
  nowMs?: () => number;
}

/** Drops every per-instance bucket. Tests only. */
export function resetRateLimitBucketsForTests() {
  burstBucket.reset();
  hardBucket.reset();
}

export function allowed(source: RateLimitSource): RateLimitResult {
  return {
    allowed: true,
    source,
    remainingMinute: null,
    remainingHour: null,
    remainingDay: null,
  };
}

/**
 * Prefilter sizing.
 *
 * `capacity = ceil(perMinute x burstFactor)`, refilling that capacity over a
 * minute. NOT `min(perMinute, perHour/60, perDay/1440)` — that formula (a
 * recorded defect) derives a per-second trickle from the DAY limit, which on
 * any policy with a day budget throttles a normal user in-process long before
 * the real limiter ever sees the request.
 */
export function burstConfig(policy: RateLimitPolicy): TokenBucketConfig | null {
  const perMinute = policy.limits.perMinute;
  if (!perMinute || perMinute <= 0) return null;

  const capacity = Math.ceil(
    perMinute * (policy.burstFactor ?? DEFAULT_BURST_FACTOR)
  );

  return { capacity, refillPerSecond: capacity / 60 };
}

/** The un-bursted per-minute bucket: `failMode` memory, and degraded fallback. */
function hardConfig(policy: RateLimitPolicy): TokenBucketConfig | null {
  const perMinute = policy.limits.perMinute;
  if (!perMinute || perMinute <= 0) return null;

  return { capacity: perMinute, refillPerSecond: perMinute / 60 };
}

function bucketRetryAfterSeconds(config: TokenBucketConfig) {
  return Math.max(1, Math.ceil(1 / config.refillPerSecond));
}

function blockOnBucket(
  context: KeyContext,
  config: TokenBucketConfig,
  source: RateLimitSource
): RateLimitResult {
  const result = {
    allowed: false,
    source,
    reason: 'flood',
    retryAfterSeconds: bucketRetryAfterSeconds(config),
  } as const;

  context.recordEvent({
    route: context.policy.route,
    reason: result.reason,
    source,
    keyKind: context.keyKind,
    keyHash: context.keyHash,
    retryAfterSeconds: result.retryAfterSeconds,
  });

  return result;
}

/**
 * The flood breaker in front of Postgres. `null` means "carry on to the DB".
 */
export function prefilter(context: KeyContext): RateLimitResult | null {
  const config = burstConfig(context.policy);
  if (!config) return null;

  return burstBucket.tryTake(context.bucketKey, config, context.nowMs?.())
    ? null
    : blockOnBucket(context, config, 'memory-prefilter');
}

/**
 * A `failMode: 'memory'` policy: the bucket IS the ceiling, the DB is never
 * touched. Such a policy declares `perMinute` and nothing else (enforced by
 * the discriminated `RateLimitPolicy` type), because a per-instance bucket is
 * a rate, not a quota.
 */
export function consumeInMemory(context: KeyContext): RateLimitResult {
  const config = hardConfig(context.policy);
  if (!config) return allowed('memory-prefilter');

  return hardBucket.tryTake(context.bucketKey, config, context.nowMs?.())
    ? allowed('memory-prefilter')
    : blockOnBucket(context, config, 'memory-prefilter');
}

/**
 * Degraded fallback. A policy with no `perMinute` (the hourly global push
 * budget) has nothing a per-minute bucket can enforce, so it ADMITS while the
 * DB is down — which is the whole point of `degraded` for that policy: the
 * worst case is a skipped push, and failing it closed would drop the user's
 * message instead.
 */
export function consumeDegraded(context: KeyContext): RateLimitResult {
  const config = hardConfig(context.policy);
  if (!config) return allowed('degraded');

  return hardBucket.tryTake(context.bucketKey, config, context.nowMs?.())
    ? allowed('degraded')
    : blockOnBucket(context, config, 'degraded');
}
