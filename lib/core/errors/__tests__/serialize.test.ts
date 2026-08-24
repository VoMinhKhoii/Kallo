import { describe, expect, it } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';

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
    expect(body.error.resolution).toContain('Retry-After');
  });

  it('wraps unknown errors as INTERNAL 500', async () => {
    const res = serializeError(new Error('unexpected'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.resolution).toContain('Retry with backoff');
  });

  it('wraps non-Error values as INTERNAL 500', async () => {
    const res = serializeError('just a string');
    expect(res.status).toBe(500);
  });
});
