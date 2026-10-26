/**
 * The generic API rate limiter — THE ONLY entry point into this folder.
 *
 * Everything else here is folder-private: `consume.ts`, `fail-mode.ts`,
 * `policies.ts`, `key-hash.ts`, `memory-bucket.ts`, `sql-consumer.ts`,
 * `events.ts`, `log-throttle.ts` and `types.ts` exist to build this surface,
 * and nothing outside
 * `lib/infra/rate-limit/limiter/` imports them directly. Callers learn three
 * names: `assertRateLimit`, a policy name, and a key.
 *
 * Usage:
 *
 * ```ts
 * await assertRateLimit('waitlistSignupIp', { kind: 'ip', value: ip });
 * ```
 *
 * Three layers sit behind that call — a per-instance token bucket, one
 * `rate_limit_consume` statement in Postgres, and the policy's `failMode` for
 * when Postgres cannot answer. See docs/RATE_LIMITING.md.
 *
 * `acquireRateLimit` / `withRateLimit` are for a policy with a one-at-a-time
 * slot (`concurrency`): the lease they hand back frees it. `acquireSpendLease`
 * is the app-wide AI spend brake: it reserves a call's estimated cost against
 * the day's $10 before the call and settles the real cost after, optionally
 * taking a policy's windows and slot in the same call (`lease/`).
 */

export { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
export {
  assertRateLimit,
  type ConsumeRateLimitOptions,
  consumeRateLimit,
  RateLimitPolicyMisuseError,
  resetRateLimitMemoryForTests,
} from './consume';
export { RateLimitKeyError } from './key-hash';
export {
  type AcquireRateLimitOptions,
  type AcquireSpendLeaseOptions,
  acquireRateLimit,
  acquireSpendLease,
  type RateLimitLease,
  resetSpendLeaseForTests,
  type SpendLease,
  withRateLimit,
} from './lease/lease';
export {
  AI_SPEND_DAILY_LIMIT_USD,
  type AiSpendKind,
  aiSpendEstimatesUsd,
} from './lease/spend-limits';
export { type RateLimitPolicyName, rateLimitPolicies } from './policies';
export type {
  RateLimitKey,
  RateLimitKeyKind,
  RateLimitLimits,
  RateLimitReason,
  RateLimitResult,
  RateLimitSource,
} from './types';
