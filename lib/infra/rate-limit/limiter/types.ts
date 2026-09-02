/**
 * Shared vocabulary for the generic limiter. Types only — no behaviour, so
 * every sibling can import it without an import cycle.
 */

export type RateLimitKeyKind =
  | 'user'
  | 'ip'
  | 'account'
  | 'recipient'
  | 'global';

/**
 * What a request is throttled ON.
 *
 * `account` and `recipient` both carry an email, and they are deliberately
 * distinct kinds: `account` is the account a login attempt is TARGETING
 * (brute-force control), `recipient` is the mailbox an email would be SENT to
 * (bombing control). The same address in both roles must not share a counter.
 * Callers pass an already-normalized (NFC, lowercased) address; only `ip` is
 * canonicalized by the limiter, because only `ip` has a wire format.
 */
export interface RateLimitKey {
  kind: RateLimitKeyKind;
  value: string;
}

/** A missing / non-positive window means that window is NOT enforced. */
export interface RateLimitLimits {
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

/**
 * Which layer produced the verdict.
 *  - `db`              — the authoritative `rate_limit_consume` statement
 *  - `memory-prefilter`— the per-instance flood breaker in front of the DB
 *  - `degraded`        — the per-instance fallback used while the DB is down
 *  - `none`            — NOTHING was checked: the call resolved no usable key.
 *    A distinct value on purpose; reporting `db` there would make an
 *    unenforced route indistinguishable from an enforced one in telemetry.
 */
export type RateLimitSource = 'db' | 'memory-prefilter' | 'degraded' | 'none';

/**
 * Which window ran out. `flood` is the in-process token bucket, which has no
 * calendar window of its own — it is a burst breaker, not a quota.
 */
export type RateLimitReason = 'minute' | 'hour' | 'day' | 'flood';

/**
 * What an event row records. The window/flood reasons come from a real block;
 * the rest are limiter conditions worth seeing in the same trail:
 *  - `unavailable_timeout` — the DB deadline fired (pool saturation / shedding)
 *  - `unavailable_error`   — the DB round trip failed outright (DB down)
 *  - `misuse`              — the call resolved no usable key (see `'none'`)
 *
 * Timeout and error are separate values because they demand different
 * responses: one is a capacity problem, the other is an outage.
 */
export type RateLimitEventReason =
  | RateLimitReason
  | 'unavailable_timeout'
  | 'unavailable_error'
  | 'misuse';

export type RateLimitResult =
  | {
      allowed: true;
      source: RateLimitSource;
      remainingMinute: number | null;
      remainingHour: number | null;
      remainingDay: number | null;
    }
  | {
      allowed: false;
      source: RateLimitSource;
      reason: RateLimitReason;
      retryAfterSeconds: number;
    };

/**
 * One row of `public.rate_limit_consume(...)`, snake_case exactly as Postgres
 * returns it — this is the wire shape, not a domain type.
 */
export interface RateLimitConsumeRow {
  allowed: boolean;
  reason: string | null;
  retry_after_seconds: number | null;
  remaining_minute: number | null;
  remaining_hour: number | null;
  remaining_day: number | null;
}

export interface RateLimitConsumeInput {
  keyKind: RateLimitKeyKind;
  keyHash: string;
  route: string;
  limits: RateLimitLimits;
  /** Test/backfill override; production leaves it undefined so SQL uses now(). */
  now?: Date;
}

/**
 * The seam between `consume.ts` and Postgres. Tests substitute the in-memory
 * reference model (`__fixtures__/in-memory-consumer.ts`) here — that model
 * mirrors the plpgsql, it does not define it.
 */
export interface RateLimitConsumer {
  consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeRow>;
}

/**
 * What happens when the limiter cannot reach a verdict.
 *  - `closed`   — throw 503. For routes where admitting means SPENDING.
 *  - `degraded` — fall back to a tight per-instance bucket and keep serving.
 *  - `memory`   — never touch the DB at all; the bucket IS the policy.
 */
export type RateLimitFailMode = 'closed' | 'degraded' | 'memory';

interface RateLimitPolicyBase {
  /** Stable counter identity. Changing it resets everyone's quota. */
  route: string;
  /** Key kinds this policy accepts; keys of other kinds are ignored. */
  keyKinds: readonly RateLimitKeyKind[];
  /** Prefilter burst headroom over `perMinute`. Defaults to 3. */
  burstFactor?: number;
}

/**
 * A policy is discriminated on `failMode` so a `memory` policy CANNOT declare
 * an hour or day window.
 *
 * A `memory` policy never reaches Postgres, and the per-instance bucket has no
 * calendar window — it can enforce a rate, not a quota. Declaring
 * `perHour: 600` on one was therefore a limit the code silently ignored: it
 * read as an enforced ceiling in the registry and in the docs, and enforced
 * nothing. Making it a TYPE error means a future policy cannot re-introduce
 * the same lie by copy-paste.
 */
export type RateLimitPolicy =
  | (RateLimitPolicyBase & {
      failMode: 'closed' | 'degraded';
      limits: RateLimitLimits;
    })
  | (RateLimitPolicyBase & {
      failMode: 'memory';
      /** Per instance, per minute. The ONLY window a memory policy has. */
      limits: { perMinute?: number; perHour?: never; perDay?: never };
    });
