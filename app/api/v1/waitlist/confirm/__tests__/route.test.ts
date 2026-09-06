import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const confirmWaitlistSignup = vi.fn(async (..._args: unknown[]) => ({
  status: 'confirmed' as const,
  locale: 'vi' as const,
}));
vi.mock('@/lib/domain/waitlist/confirm', () => ({
  confirmWaitlistSignup: (...args: unknown[]) => confirmWaitlistSignup(...args),
}));

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const { GET } = await import('@/app/api/v1/waitlist/confirm/route');

function makeRequest(
  token: string,
  headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.4' }
): NextRequest {
  const url = new URL(
    `http://localhost/api/v1/waitlist/confirm?token=${token}`
  );
  const req = new Request(url, { headers }) as unknown as { nextUrl?: URL };
  req.nextUrl = url;
  return req as unknown as NextRequest;
}

beforeEach(() => {
  confirmWaitlistSignup.mockReset();
  confirmWaitlistSignup.mockResolvedValue({
    status: 'confirmed',
    locale: 'vi',
  });
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

describe('GET /api/v1/waitlist/confirm', () => {
  it('charges the global then IP policy, then redirects with the outcome', async () => {
    const res = await GET(makeRequest('tok_123'));

    expect(assertRateLimit).toHaveBeenCalledWith('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist-confirm',
    });
    expect(assertRateLimit).toHaveBeenCalledWith('waitlistConfirmIp', {
      kind: 'ip',
      value: '203.0.113.4',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/vi/?waitlist=confirmed');
    expect(confirmWaitlistSignup).toHaveBeenCalledWith('tok_123');
  });

  it('still charges the global policy when there is no usable client IP', async () => {
    const res = await GET(makeRequest('tok_123', {}));

    expect(assertRateLimit).toHaveBeenCalledWith('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist-confirm',
    });
    expect(assertRateLimit).not.toHaveBeenCalledWith(
      'waitlistConfirmIp',
      expect.anything()
    );
    expect(res.status).toBe(307);
  });

  it('refuses a null-IP guessing flood once the global limit is hit', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 12));

    const res = await GET(makeRequest('guess', {}));

    expect(res.status).toBe(429);
    expect(assertRateLimit).toHaveBeenCalledWith('waitlistGlobal', {
      kind: 'global',
      value: 'waitlist-confirm',
    });
    expect(confirmWaitlistSignup).not.toHaveBeenCalled();
  });

  // Token guessing must cost something: every outcome returns the same shape,
  // so an attacker learns nothing per attempt — but nothing stops the attempts
  // except this.
  it('answers a token-guessing flood with 429 and never reads the token', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 12));

    const res = await GET(makeRequest('guess'));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(confirmWaitlistSignup).not.toHaveBeenCalled();
  });
});
