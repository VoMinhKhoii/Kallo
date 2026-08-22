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
      },
    };
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
        feature: this.feature,
        reason: this.reason,
      },
    };
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
