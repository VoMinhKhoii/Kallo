import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AppError,
  Errors,
  isAppError,
  parseApiError,
  serializeError,
} from '@/lib/errors';

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('constructs with all fields', () => {
    const err = new AppError('TEST', 400, false, 'Test message');
    expect(err.code).toBe('TEST');
    expect(err.status).toBe(400);
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toBe('Test message');
    expect(err.message).toBe('Test message');
    expect(err.name).toBe('AppError');
  });

  it('stores cause', () => {
    const cause = new Error('root');
    const err = new AppError('TEST', 500, true, 'Wrapper', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON returns structured payload', () => {
    const err = new AppError('RATE_LIMITED', 429, true, 'Slow down');
    expect(err.toJSON()).toEqual({
      error: {
        code: 'RATE_LIMITED',
        status: 429,
        retryable: true,
        message: 'Slow down',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// isAppError
// ---------------------------------------------------------------------------

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    expect(isAppError(Errors.internal())).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isAppError(new Error('nope'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serializeError
// ---------------------------------------------------------------------------

describe('serializeError', () => {
  it('serializes AppError with correct status', async () => {
    const res = serializeError(Errors.rateLimited());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.retryable).toBe(true);
  });

  it('wraps unknown errors as INTERNAL 500', async () => {
    const res = serializeError(new Error('unexpected'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
  });

  it('wraps non-Error values as INTERNAL 500', async () => {
    const res = serializeError('just a string');
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Errors factories
// ---------------------------------------------------------------------------

describe('Errors factories', () => {
  it('notAuthenticated is 401 non-retryable', () => {
    const err = Errors.notAuthenticated();
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
  });

  it('profileNotFound is 404', () => {
    const err = Errors.profileNotFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe('PROFILE_NOT_FOUND');
  });

  it('pipelineTimeout is 504 retryable', () => {
    const err = Errors.pipelineTimeout();
    expect(err.status).toBe(504);
    expect(err.retryable).toBe(true);
  });

  it('validationFailed accepts detail', () => {
    const err = Errors.validationFailed('Bad input');
    expect(err.status).toBe(400);
    expect(err.userMessage).toBe('Bad input');
  });

  it('rateLimited is 429 retryable', () => {
    const err = Errors.rateLimited();
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });

  it('internal stores cause', () => {
    const cause = new TypeError('oops');
    const err = Errors.internal(cause);
    expect(err.status).toBe(500);
    expect(err.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// ApiError + parseApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('constructs with code, status, retryable', () => {
    const err = new ApiError('RATE_LIMITED', 429, true);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe('ApiError');
  });
});

describe('parseApiError', () => {
  it('parses valid error body', () => {
    const body = {
      error: {
        code: 'PIPELINE_TIMEOUT',
        status: 504,
        retryable: true,
        message: 'Timeout',
      },
    };
    const err = parseApiError(body);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('PIPELINE_TIMEOUT');
    expect(err.status).toBe(504);
    expect(err.retryable).toBe(true);
  });

  it('returns UNKNOWN for malformed body', () => {
    const err = parseApiError({ unexpected: true });
    expect(err.code).toBe('UNKNOWN');
    expect(err.status).toBe(500);
  });

  it('returns UNKNOWN for null body', () => {
    const err = parseApiError(null);
    expect(err.code).toBe('UNKNOWN');
  });

  it('handles missing fields gracefully', () => {
    const err = parseApiError({ error: {} });
    expect(err.code).toBe('UNKNOWN');
    expect(err.status).toBe(500);
    expect(err.retryable).toBe(false);
  });
});
