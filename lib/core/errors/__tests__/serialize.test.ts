import { inspect } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException }));

// ---------------------------------------------------------------------------
// serializeError
// ---------------------------------------------------------------------------

describe('serializeError', () => {
  it('sanitizes database failures before handing them to Sentry', async () => {
    captureException.mockClear();
    const error = new DrizzleQueryError(
      'insert into weights values ($1)',
      [72.54321],
      Object.assign(new Error('bad 72.54321'), { code: '22P02' })
    );
    expect(serializeError(error).status).toBe(500);
    const sent = inspect(captureException.mock.calls);
    expect(sent).toContain('insert into weights');
    expect(sent).toContain('22P02');
    expect(sent).not.toContain('72.54321');
  });
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
