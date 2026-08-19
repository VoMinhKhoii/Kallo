import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';

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
