// ---------------------------------------------------------------------------
// AppError — structured error class for server-side use
//
// Runtime-agnostic on purpose: no `next/server`, no DOM. The server HTTP edge
// lives in `serialize.ts`, the browser edge in `client.ts`, so importing an
// error type never drags a `NextResponse` into a client bundle.
// ---------------------------------------------------------------------------

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean,
    public readonly userMessage: string,
    cause?: unknown
  ) {
    super(userMessage, { cause });
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        status: this.status,
        retryable: this.retryable,
        message: this.userMessage,
        resolution: resolutionFor(this.status, this.retryable),
      },
    };
  }
}

/**
 * Stable, machine-actionable next step for an HTTP failure.
 *
 * The human message may be localized or domain-specific. Resolution is kept
 * deliberately small and status-driven so an agent can decide what to do next
 * without parsing prose or learning every domain error code first.
 */
function resolutionFor(status: number, retryable: boolean): string {
  switch (status) {
    case 400:
      return 'Correct the request using the published schema, then retry.';
    case 401:
      return 'Authenticate with a valid Kallo user access token, then retry.';
    case 402:
      return 'Use an account whose plan includes this feature.';
    case 404:
      return 'Verify the path and resource identifier against /openapi.json.';
    case 409:
      return 'Read the latest resource state, reconcile the conflict, then retry.';
    case 422:
      return 'Change the supplied content as described by the error message.';
    case 429:
      return 'Wait for Retry-After when present, then retry with backoff.';
    default:
      return retryable
        ? 'Retry with backoff; contact support if the failure persists.'
        : 'Change the request or account state before retrying.';
  }
}

/**
 * A 429 that knows how long to wait. Extends AppError so every existing
 * `isAppError` / `serializeError` path keeps working unchanged; the extra field
 * only adds the `Retry-After` header when a caller supplied one.
 */
export class RateLimitedError extends AppError {
  constructor(
    userMessage: string,
    public readonly retryAfterSeconds?: number
  ) {
    super('RATE_LIMITED', 429, true, userMessage);
    this.name = 'RateLimitedError';
  }
}

/**
 * The rate limiter itself could not reach a verdict (its database round trip
 * errored or blew its deadline) on a policy whose `failMode` is `'closed'`.
 *
 * 503, not 429: nothing about the caller is over quota — the guard in front of
 * a spend route is down, and admitting the request would mean spending money
 * with no ceiling. Retryable with a fixed `Retry-After`, because the outage is
 * expected to be brief and the client should not treat it as a quota denial.
 */
export class RateLimitUnavailableError extends AppError {
  constructor(
    userMessage: string,
    public readonly retryAfterSeconds: number,
    /**
     * WHY the limiter could not answer. `timeout` means the DB deadline fired
     * — the pool is saturated and we are shedding load; `error` means the
     * round trip failed outright — the database is unreachable or the function
     * is wrong. Same 503 to the client, but the two demand opposite operator
     * responses, so telemetry keeps them apart.
     */
    public readonly kind: RateLimitUnavailableKind = 'error',
    cause?: unknown
  ) {
    super('RATE_LIMITER_UNAVAILABLE', 503, true, userMessage, cause);
    this.name = 'RateLimitUnavailableError';
  }
}

export type RateLimitUnavailableKind = 'timeout' | 'error';

// Reasons a gated feature is locked, mirrored from the entitlement service.
export type FeatureLockedReason = 'trial_expired' | 'not_entitled';

// FeatureLockedError — a 402 with the extra `feature` + `reason` fields the
// client keys on to open the paywall. Extends AppError so serializeError and
// the isAppError guard keep working; overrides toJSON to add the two fields.
export class FeatureLockedError extends AppError {
  constructor(
    public readonly feature: string,
    public readonly reason: FeatureLockedReason,
    userMessage: string
  ) {
    super('feature_locked', 402, false, userMessage);
    this.name = 'FeatureLockedError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        status: this.status,
        retryable: this.retryable,
        message: this.userMessage,
        resolution: resolutionFor(this.status, this.retryable),
        feature: this.feature,
        reason: this.reason,
      },
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
