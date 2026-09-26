import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const requireUser = vi.fn();
const assertRateLimit = vi.fn();
const linkAppleAuthorizationCode = vi.fn();

vi.mock('@/lib/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/auth')>()),
  requireUser,
}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/domain/apple-sign-in/refresh-tokens', () => ({
  linkAppleAuthorizationCode,
}));

const { POST } = await import('@/app/api/v1/auth/apple/token/route');

const appleUser = {
  id: 'user-123',
  identities: [
    { provider: 'google', id: 'g-1', identity_data: { sub: 'g-1' } },
    { provider: 'apple', id: 'a-1', identity_data: { sub: '001.apple' } },
  ],
};

function makeRequest(body: unknown): NextRequest {
  return new Request('https://kallo.test/api/v1/auth/apple/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue(appleUser);
  assertRateLimit.mockResolvedValue(undefined);
  linkAppleAuthorizationCode.mockResolvedValue('stored');
});

describe('POST /api/v1/auth/apple/token', () => {
  it('links the code against the caller’s own Apple subject', async () => {
    const res = await POST(makeRequest({ authorizationCode: ' code-1 ' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stored: true });
    expect(assertRateLimit).toHaveBeenCalledWith('appleTokenLink', {
      kind: 'user',
      value: 'user-123',
    });
    expect(linkAppleAuthorizationCode).toHaveBeenCalledWith({
      userId: 'user-123',
      appleSubject: '001.apple',
      authorizationCode: 'code-1',
    });
  });

  it('reports stored: false when the deployment has no Apple credentials', async () => {
    linkAppleAuthorizationCode.mockResolvedValue('not_configured');
    const res = await POST(makeRequest({ authorizationCode: 'code-1' }));
    expect(await res.json()).toEqual({ stored: false });
  });

  it('answers 401 without reading the body or charging the limiter', async () => {
    requireUser.mockRejectedValue(Errors.notAuthenticated());
    const res = await POST(makeRequest({ authorizationCode: 'code-1' }));
    expect(res.status).toBe(401);
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(linkAppleAuthorizationCode).not.toHaveBeenCalled();
  });

  it('refuses an account with no Apple identity', async () => {
    requireUser.mockResolvedValue({ id: 'user-123', identities: [] });
    const res = await POST(makeRequest({ authorizationCode: 'code-1' }));
    expect(res.status).toBe(409);
    expect(linkAppleAuthorizationCode).not.toHaveBeenCalled();
  });

  it('validates the body shape and bounds the code length', async () => {
    for (const body of [
      {},
      { authorizationCode: '' },
      { authorizationCode: 'x'.repeat(1025) },
      { authorizationCode: 'ok', extra: true },
    ]) {
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    }
    expect(linkAppleAuthorizationCode).not.toHaveBeenCalled();
  });

  it('passes a rate-limit refusal through as 429', async () => {
    assertRateLimit.mockRejectedValue(Errors.rateLimited(undefined, 30));
    const res = await POST(makeRequest({ authorizationCode: 'code-1' }));
    expect(res.status).toBe(429);
  });
});
