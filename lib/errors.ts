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
// Error factories — Vietnamese user-facing messages
// ---------------------------------------------------------------------------

export const Errors = {
  notAuthenticated: () =>
    new AppError(
      'NOT_AUTHENTICATED',
      401,
      false,
      'Bạn cần đăng nhập để sử dụng tính năng này.'
    ),

  onboardingIncomplete: () =>
    new AppError(
      'ONBOARDING_INCOMPLETE',
      403,
      false,
      'Vui lòng hoàn thành thiết lập hồ sơ trước.'
    ),

  pipelineTimeout: () =>
    new AppError(
      'PIPELINE_TIMEOUT',
      504,
      true,
      'Phân tích mất quá lâu. Vui lòng thử lại.'
    ),

  validationFailed: (detail: string) =>
    new AppError('VALIDATION_FAILED', 400, false, detail),

  rateLimited: () =>
    new AppError(
      'RATE_LIMITED',
      429,
      true,
      'Hệ thống đang bận. Vui lòng đợi một chút rồi thử lại.'
    ),

  internal: (cause?: unknown) =>
    new AppError(
      'INTERNAL',
      500,
      true,
      'Đã xảy ra lỗi. Vui lòng thử lại.',
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
