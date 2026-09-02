import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const signUpForWaitlist = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/domain/waitlist/signup', () => ({
  signUpForWaitlist: (...args: unknown[]) => signUpForWaitlist(...args),
}));

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const { POST } = await import('@/app/api/v1/waitlist/route');

function makeRequest(
  body: string,
  headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.4' }
): NextRequest {
  return new Request('http://localhost/api/v1/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  }) as unknown as NextRequest;
}

beforeEach(() => {
  signUpForWaitlist.mockReset();
  signUpForWaitlist.mockResolvedValue(undefined);
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

describe('POST /api/v1/waitlist', () => {
  it('charges the IP policy, then signs the address up', async () => {
    const res = await POST(makeRequest('{"email":"a@b.co","locale":"vi"}'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(assertRateLimit).toHaveBeenCalledWith('waitlistSignupIp', {
      kind: 'ip',
      value: '203.0.113.4',
    });
    expect(signUpForWaitlist).toHaveBeenCalledWith(
      { email: 'a@b.co', locale: 'vi' },
      { ip: '203.0.113.4' }
    );
  });

  // With no IP there is no key, and a limiter called with no key counts
  // nothing. The per-address cooldown inside signUpForWaitlist is the control
  // that still applies, which is why skipping is safe rather than a hole.
  it('skips the limiter when there is no usable client IP', async () => {
    const res = await POST(makeRequest('{"email":"a@b.co"}', {}));

    expect(res.status).toBe(200);
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(signUpForWaitlist).toHaveBeenCalledWith(
      { email: 'a@b.co' },
      { ip: null }
    );
  });

  it('answers a rate-limited signup with 429 and Retry-After', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 30));

    const res = await POST(makeRequest('{"email":"a@b.co"}'));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    expect(signUpForWaitlist).not.toHaveBeenCalled();
  });

  it('answers an oversized body with 413 and never reaches the domain', async () => {
    const res = await POST(
      makeRequest(`{"email":"a@b.co","source":"${'x'.repeat(8 * 1024)}"}`)
    );

    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(signUpForWaitlist).not.toHaveBeenCalled();
  });

  it('still validates the body against the contract', async () => {
    const res = await POST(makeRequest('{"email":"not-an-email"}'));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_FAILED');
    expect(signUpForWaitlist).not.toHaveBeenCalled();
  });
});
