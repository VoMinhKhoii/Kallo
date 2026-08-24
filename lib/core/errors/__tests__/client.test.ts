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
});
