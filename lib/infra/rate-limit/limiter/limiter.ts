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
 * This module is NOT the analysis guard. `checkAnalysisGuards` stays where it
 * is for analyze-meal / relog / reconcile / OG / OCR, because it also models
 * CONCURRENCY (an in-flight slot with a release), which this limiter has no
 * concept of.
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
export { type RateLimitPolicyName, rateLimitPolicies } from './policies';
export type {
  RateLimitKey,
  RateLimitKeyKind,
  RateLimitLimits,
  RateLimitReason,
  RateLimitResult,
  RateLimitSource,
} from './types';
