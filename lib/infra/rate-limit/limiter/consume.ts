import { RateLimitUnavailableError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { recordRateLimitEvent } from './events';
import {
  allowed,
  consumeDegraded,
  consumeInMemory,
  type KeyContext,
  prefilter,
  resetRateLimitBucketsForTests,
} from './fail-mode';
import { hashRateLimitKey, RateLimitKeyError } from './key-hash';
import { logThrottled, resetLogThrottleForTests } from './log-throttle';
import { getRateLimitPolicy, type RateLimitPolicyName } from './policies';
import { createSqlRateLimitConsumer } from './sql-consumer';
import type {
  RateLimitConsumer,
  RateLimitEventReason,
  RateLimitKey,
  RateLimitKeyKind,
  RateLimitPolicy,
  RateLimitReason,
  RateLimitResult,
} from './types';

/**
 * Cheapest rejection first. A `global` budget is one row for the whole app, so
 * checking it before the per-client keys means an app-wide flood costs one
 * statement per request instead of three, and the narrowest keys (the ones an
 * attacker is actively rotating) are only paid for by traffic that got past
 * the coarse budget.
 */
const KEY_KIND_ORDER: readonly RateLimitKeyKind[] = [
  'global',
  'ip',
  'account',
  'recipient',
  'user',
];

let cachedSqlConsumer: RateLimitConsumer | undefined;

export interface ConsumeRateLimitOptions {
  /** Seam for tests; production resolves the SQL consumer lazily. */
  consumer?: RateLimitConsumer;
  now?: Date;
  /** Seam for tests so telemetry does not require a live database. */
  recordEvent?: typeof recordRateLimitEvent;
  /**
   * Monotonic clock for the per-instance buckets. Test seam: the buckets are
   * module-level singletons, so this is the only way to advance time and prove
   * the prefilter refills at `capacity/60` per second.
   */
  nowMs?: () => number;
}

/**
 * A policy was applied to a call that carries no key it can count.
 *
 * Wrong `kind` for the policy, an empty value, or every key unparseable — all
 * mean the same thing: this request was NOT rate limited. Loud in dev/test,
 * because a silently unenforced limiter is worse than no limiter (it looks
 * enforced in code review and in the policy table).
 */
export class RateLimitPolicyMisuseError extends Error {
  constructor(
    public readonly route: string,
    message: string
  ) {
    super(message);
    this.name = 'RateLimitPolicyMisuseError';
  }
}

/** Drops every per-instance bucket and log-throttle timer. Tests only. */
export function resetRateLimitMemoryForTests() {
  resetRateLimitBucketsForTests();
  resetLogThrottleForTests();
  cachedSqlConsumer = undefined;
}

function getSqlConsumer() {
  cachedSqlConsumer ??= createSqlRateLimitConsumer();
  return cachedSqlConsumer;
}

function toReason(value: string | null): RateLimitReason {
  if (value === 'hour' || value === 'day' || value === 'flood') return value;
  return 'minute';
}

/**
 * `unavailable_timeout` vs `unavailable_error`: the deadline firing means the
 * pool is saturated and we are shedding load; anything else means the database
 * itself is unreachable. Same 503 to the caller, opposite operator response.
 */
function unavailableReason(error: unknown): RateLimitEventReason {
  return error instanceof RateLimitUnavailableError && error.kind === 'timeout'
    ? 'unavailable_timeout'
    : 'unavailable_error';
}

async function consumeOneKey(
  context: KeyContext,
  options: ConsumeRateLimitOptions
): Promise<RateLimitResult> {
  const { policy } = context;

  if (policy.failMode === 'memory') return consumeInMemory(context);

  const flooded = prefilter(context);
  if (flooded) return flooded;

  try {
    const row = await (options.consumer ?? getSqlConsumer()).consume({
      keyKind: context.keyKind,
      keyHash: context.keyHash,
      route: policy.route,
      limits: policy.limits,
      now: options.now,
    });

    if (row.allowed) {
      return {
        allowed: true,
        source: 'db',
        remainingMinute: row.remaining_minute,
        remainingHour: row.remaining_hour,
        remainingDay: row.remaining_day,
      };
    }

    const result = {
      allowed: false,
      source: 'db',
      reason: toReason(row.reason),
      retryAfterSeconds: Math.max(1, row.retry_after_seconds ?? 1),
    } as const;

    context.recordEvent({
      route: policy.route,
      reason: result.reason,
      source: 'db',
      keyKind: context.keyKind,
      keyHash: context.keyHash,
      retryAfterSeconds: result.retryAfterSeconds,
    });

    return result;
  } catch (error) {
    logThrottled(
      `consume:${policy.route}`,
      `[rate-limit] consume failed for ${policy.route}`,
      error
    );

    if (policy.failMode === 'closed') {
      context.recordEvent({
        route: policy.route,
        reason: unavailableReason(error),
        source: 'db',
        keyKind: context.keyKind,
        keyHash: context.keyHash,
        retryAfterSeconds: null,
      });

      throw error instanceof RateLimitUnavailableError
        ? error
        : Errors.rateLimiterUnavailable(error, 'error');
    }

    return consumeDegraded(context);
  }
}

/**
 * Keys this policy accepts, cheapest rejection first.
 *
 * Exported (folder-private) so the ordering can be tested on its own: every
 * policy in the registry is single-key today, so the ordering has no observable
 * effect until a multi-key policy exists, and an untested invariant that only
 * matters later is an invariant that quietly rots.
 */
export function orderRateLimitKeys(
  policy: RateLimitPolicy,
  keys: readonly RateLimitKey[]
): RateLimitKey[] {
  return keys
    .filter((key) => policy.keyKinds.includes(key.kind))
    .sort(
      (left, right) =>
        KEY_KIND_ORDER.indexOf(left.kind) - KEY_KIND_ORDER.indexOf(right.kind)
    );
}

/**
 * Nothing was counted, so nothing was limited.
 *
 * Returning a plain `allowed` here (the previous behaviour) meant a policy
 * applied with the wrong key kind, an empty value, or an unparseable IP as its
 * ONLY key silently admitted every request while reporting `source: 'db'` —
 * indistinguishable in telemetry from an enforced pass. Dev and test fail
 * fast; production admits, because breaking a live route is the worse of the
 * two failures, but it says so in the log and in the event trail with a source
 * that cannot be mistaken for enforcement.
 */
function noResolvedKeys(
  policy: RateLimitPolicy,
  recordEvent: typeof recordRateLimitEvent
): RateLimitResult {
  const message = `[rate-limit] ${policy.route} resolved no usable key (accepts ${policy.keyKinds.join(', ')}) — the request was NOT limited`;

  recordEvent({
    route: policy.route,
    reason: 'misuse',
    source: 'none',
    keyKind: policy.keyKinds[0] ?? 'global',
    // Not a hash: there was no value to hash. Fixed sentinel so the row groups.
    keyHash: 'none',
    retryAfterSeconds: null,
  });

  if (process.env.NODE_ENV !== 'production') {
    throw new RateLimitPolicyMisuseError(policy.route, message);
  }

  logThrottled(`misuse:${policy.route}`, message);

  return allowed('none');
}

/**
 * Run every key a policy accepts, cheapest first, and return the FIRST block.
 *
 * All listed keys must pass, so a later key is only consumed when the earlier
 * ones admitted — which is also why a block short-circuits: charging the
 * narrower counters for a request that was already refused would let one
 * attacker burn a victim's per-account budget.
 *
 * A key whose value cannot be canonicalized (an unparseable IP) is SKIPPED, so
 * the caller's remaining keys still apply. If that leaves NO key at all, see
 * `noResolvedKeys` — it is never treated as a pass.
 */
export async function consumeRateLimit(
  policyName: RateLimitPolicyName,
  keyOrKeys: RateLimitKey | readonly RateLimitKey[],
  options: ConsumeRateLimitOptions = {}
): Promise<RateLimitResult> {
  const policy = getRateLimitPolicy(policyName);
  const recordEvent = options.recordEvent ?? recordRateLimitEvent;
  const keys = orderRateLimitKeys(
    policy,
    Array.isArray(keyOrKeys)
      ? (keyOrKeys as readonly RateLimitKey[])
      : [keyOrKeys as RateLimitKey]
  );

  let result: RateLimitResult | undefined;

  for (const key of keys) {
    let keyHash: string;

    try {
      keyHash = hashRateLimitKey(key);
    } catch (error) {
      if (error instanceof RateLimitKeyError) continue;
      throw error;
    }

    result = await consumeOneKey(
      {
        policy,
        keyKind: key.kind,
        keyHash,
        bucketKey: `${policy.route}:${key.kind}:${keyHash}`,
        recordEvent,
        nowMs: options.nowMs,
      },
      options
    );

    if (!result.allowed) return result;
  }

  return result ?? noResolvedKeys(policy, recordEvent);
}

/**
 * Consume, and throw a 429 if the policy says no.
 *
 * Throws rather than returning a verdict because a Server Action has no
 * `Response` to hand back: `serializeError` turns `RateLimitedError` into the
 * same 429 + `Retry-After` a route would have built by hand, so one call site
 * shape works for routes and actions alike.
 */
export async function assertRateLimit(
  policyName: RateLimitPolicyName,
  keyOrKeys: RateLimitKey | readonly RateLimitKey[],
  options: ConsumeRateLimitOptions = {}
): Promise<void> {
  const result = await consumeRateLimit(policyName, keyOrKeys, options);

  if (!result.allowed) {
    throw Errors.rateLimited(undefined, result.retryAfterSeconds);
  }
}
