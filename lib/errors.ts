import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// AppError — structured error class for server-side use
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

// ---------------------------------------------------------------------------
// Type guard & serialization
// ---------------------------------------------------------------------------

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

/**
 * Serialize any thrown value into a NextResponse JSON payload.
 * - AppError → structured JSON with correct status
 * - Unknown  → generic 500
 */
export function serializeError(e: unknown): NextResponse {
  if (isAppError(e)) {
    return NextResponse.json(e.toJSON(), {
      status: e.status,
      // A 429 without `Retry-After` tells the client to back off but not for how
      // long, so it guesses — and a client that guesses low re-enters the limit
      // immediately. Carried on the error rather than added by each route so a
      // throttle stays correct wherever it is thrown from, including a Server
      // Action that never touches a Response.
      ...(e instanceof RateLimitedError && e.retryAfterSeconds != null
        ? { headers: { 'Retry-After': String(e.retryAfterSeconds) } }
        : {}),
    });
  }
  const fallback = Errors.internal(e);
  return NextResponse.json(fallback.toJSON(), { status: fallback.status });
}

// ---------------------------------------------------------------------------
// Error factories
//
// Defaults are English. Call sites that have access to the user's locale
// (the analyze-meal route, [locale] server actions) should resolve the
// translation via next-intl `getTranslations('errors')` and pass it in via
// the optional `message` argument. Call sites without a locale context fall
// back to the English default — which matches `defaultLocale: 'en'`.
// ---------------------------------------------------------------------------

const DEFAULT_MESSAGES = {
  notAuthenticated: 'You need to sign in to use this feature.',
  profileNotFound: 'Profile not found. Please sign in again.',
  pipelineTimeout: 'Analysis took too long. Please try again.',
  rateLimited: 'The service is busy. Please wait a moment and try again.',
  featureLocked: 'Upgrade to keep using this feature.',
  internal: 'Something went wrong. Please try again.',
} as const;

// Reasons a gated feature is locked, mirrored from the entitlement service.
export type FeatureLockedReason = 'trial_expired' | 'not_entitled';

export const Errors = {
  notAuthenticated: (message?: string) =>
    new AppError(
      'NOT_AUTHENTICATED',
      401,
      false,
      message ?? DEFAULT_MESSAGES.notAuthenticated
    ),

  profileNotFound: (message?: string) =>
    new AppError(
      'PROFILE_NOT_FOUND',
      404,
      false,
      message ?? DEFAULT_MESSAGES.profileNotFound
    ),

  pipelineTimeout: (message?: string) =>
    new AppError(
      'PIPELINE_TIMEOUT',
      504,
      true,
      message ?? DEFAULT_MESSAGES.pipelineTimeout
    ),

  validationFailed: (detail: string) =>
    new AppError('VALIDATION_FAILED', 400, false, detail),

  notFound: (detail: string) => new AppError('NOT_FOUND', 404, false, detail),

  conflict: (detail: string) => new AppError('CONFLICT', 409, false, detail),

  rateLimited: (message?: string, retryAfterSeconds?: number) =>
    new RateLimitedError(
      message ?? DEFAULT_MESSAGES.rateLimited,
      retryAfterSeconds
    ),

  featureLocked: (
    feature: string,
    reason: FeatureLockedReason,
    message?: string
  ) =>
    new FeatureLockedError(
      feature,
      reason,
      message ?? DEFAULT_MESSAGES.featureLocked
    ),

  internal: (cause?: unknown, message?: string) =>
    new AppError(
      'INTERNAL',
      500,
      true,
      message ?? DEFAULT_MESSAGES.internal,
      cause
    ),
};

// ---------------------------------------------------------------------------
// ApiError — client-side error class for parsing API responses
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * Parse the `{ error: { code, status, retryable, message } }` shape
 * returned by `serializeError` into an `ApiError` instance.
 */
export function parseApiError(body: unknown): ApiError {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as Record<string, unknown>).error === 'object'
  ) {
    const err = (body as { error: Record<string, unknown> }).error;
    return new ApiError(
      typeof err.code === 'string' ? err.code : 'UNKNOWN',
      typeof err.status === 'number' ? err.status : 500,
      typeof err.retryable === 'boolean' ? err.retryable : false
    );
  }
  return new ApiError('UNKNOWN', 500, false);
}
