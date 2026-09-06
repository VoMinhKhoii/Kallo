import { describe, expect, it } from 'vitest';
import { ApiError, parseApiError } from '@/lib/core/errors/client';

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
        resolution: 'Retry with backoff.',
      },
    };
    const err = parseApiError(body);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('PIPELINE_TIMEOUT');
    expect(err.status).toBe(504);
    expect(err.retryable).toBe(true);
    expect(err.resolution).toBe('Retry with backoff.');
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

  it('carries the server message through Error.message', () => {
    const err = parseApiError({
      error: {
        code: 'CIRCLE_LIMIT_REACHED',
        status: 409,
        retryable: false,
        message: 'Mai đã đạt giới hạn 2 nhóm.',
      },
    });
    expect(err.serverMessage).toBe('Mai đã đạt giới hạn 2 nhóm.');
    expect(err.message).toBe('Mai đã đạt giới hạn 2 nhóm.');
  });

  it('carries feature + reason from a feature_locked envelope', () => {
    const err = parseApiError({
      error: {
        code: 'feature_locked',
        status: 402,
        retryable: false,
        message: 'Upgrade to keep using this feature.',
        feature: 'relog',
        reason: 'trial_expired',
      },
    });
    expect(err.status).toBe(402);
    expect(err.feature).toBe('relog');
    expect(err.reason).toBe('trial_expired');
  });

  it('leaves message/feature/reason undefined when absent', () => {
    const err = parseApiError({
      error: { code: 'CONFLICT', status: 409, retryable: false },
    });
    expect(err.serverMessage).toBeUndefined();
    expect(err.feature).toBeUndefined();
    expect(err.reason).toBeUndefined();
    // Error.message falls back to the code, as before the widening.
    expect(err.message).toBe('CONFLICT');
  });
});
