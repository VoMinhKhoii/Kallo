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
    return NextResponse.json(e.toJSON(), { status: e.status });
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
  internal: 'Something went wrong. Please try again.',
} as const;

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

  rateLimited: (message?: string) =>
    new AppError(
      'RATE_LIMITED',
      429,
      true,
      message ?? DEFAULT_MESSAGES.rateLimited
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
