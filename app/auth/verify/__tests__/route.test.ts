import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn(),
}));

const assertRateLimit = vi.fn();
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));

const { handleVerify } = await import('@/app/auth/verify/route');
const { Errors } = await import('@/lib/core/errors/catalog');

beforeEach(() => {
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});

function mockSupabase(error?: { message: string } | null) {
  return {
    auth: {
      verifyOtp: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: error ?? null }),
    },
  } as unknown as Awaited<
    ReturnType<typeof import('@/lib/infra/supabase/server').createClient>
  >;
}

function makeRequest(
  searchParams: Record<string, string>,
  init?: { url?: string; headers?: Record<string, string> }
) {
  const url = new URL(init?.url ?? 'http://localhost:3000/auth/verify');
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { headers: init?.headers });
}

describe('handleVerify', () => {
  it('verifies an email token and lands on default /{locale}/logging', async () => {
    const supabase = mockSupabase();
    const res = await handleVerify(
      makeRequest({ token_hash: 'hash123', type: 'email' }),
      { supabase }
    );

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'hash123',
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/en/logging'
    );
  });

  it('sends recovery to the password-reset screen by default', async () => {
    const res = await handleVerify(
      makeRequest({ token_hash: 'hash123', type: 'recovery' }),
      { supabase: mockSupabase() }
    );
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/en/reset-password'
    );
  });

  it('honors a safe next path over the default target', async () => {
    const res = await handleVerify(
      makeRequest({
        token_hash: 'hash123',
        type: 'recovery',
        next: '/vi/reset-password',
      }),
      { supabase: mockSupabase() }
    );
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/vi/reset-password'
    );
  });

  it('redirects to verify_failed without calling verifyOtp when token_hash is missing', async () => {
    const supabase = mockSupabase();
    const res = await handleVerify(makeRequest({ type: 'email' }), {
      supabase,
    });
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/en/?error=verify_failed'
    );
  });

  it('rejects an unknown otp type without calling verifyOtp', async () => {
    const supabase = mockSupabase();
    const res = await handleVerify(
      makeRequest({ token_hash: 'hash123', type: 'not_a_type' }),
      { supabase }
    );
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/en/?error=verify_failed'
    );
  });

  it('maps a verifyOtp error to verify_failed, preserving locale from next', async () => {
    const res = await handleVerify(
      makeRequest({
        token_hash: 'expired',
        type: 'recovery',
        next: '/vi/reset-password',
      }),
      { supabase: mockSupabase({ message: 'token expired' }) }
    );
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/vi/?error=verify_failed'
    );
  });

  it('rejects an unsafe next and falls back to the default target', async () => {
    const res = await handleVerify(
      makeRequest({
        token_hash: 'hash123',
        type: 'email',
        next: '//evil.com/steal',
      }),
      { supabase: mockSupabase() }
    );
    const location = res.headers.get('location') ?? '';
    expect(location).toBe('http://localhost:3000/en/logging');
    expect(new URL(location).origin).toBe('http://localhost:3000');
  });

  it('throttles per source IP before calling GoTrue', async () => {
    // Anonymous, and it verifies the token upstream for whoever opened the URL,
    // so an unbounded flood of guessed token_hash values spends the app's
    // SHARED per-IP token_verifications budget at Supabase.
    const supabase = mockSupabase();
    const res = await handleVerify(
      makeRequest(
        { token_hash: 'hash123', type: 'email' },
        { headers: { 'x-forwarded-for': '203.0.113.5' } }
      ),
      { supabase }
    );

    expect(assertRateLimit).toHaveBeenCalledWith('authLinkIp', {
      kind: 'ip',
      value: '203.0.113.5',
    });
    expect(supabase.auth.verifyOtp).toHaveBeenCalled();
    expect(res.status).toBe(307);
  });

  it('answers a throttled link with the redirect, never a JSON 429', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 30));
    const supabase = mockSupabase();

    const res = await handleVerify(
      makeRequest(
        { token_hash: 'hash123', type: 'email' },
        { headers: { 'x-forwarded-for': '203.0.113.5' } }
      ),
      { supabase }
    );

    // A browser navigation cannot render an error envelope; it gets the same
    // "that link did not work" screen a failed verify produces.
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/en/?error=verify_failed'
    );
  });

  it('admits when no IP key is available rather than refusing the link', async () => {
    const supabase = mockSupabase();
    await handleVerify(makeRequest({ token_hash: 'hash123', type: 'email' }), {
      supabase,
    });

    // `getRequestIp` returns null when the request did not arrive through the
    // edge. A policy applied with no key counts nothing, so it is not called.
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(supabase.auth.verifyOtp).toHaveBeenCalled();
  });

  it('uses x-forwarded-host + proto behind a reverse proxy', async () => {
    const res = await handleVerify(
      makeRequest(
        { token_hash: 'hash123', type: 'email' },
        {
          url: 'http://0.0.0.0:8080/auth/verify',
          headers: {
            host: '0.0.0.0:8080',
            'x-forwarded-host': 'nham-internal.example.com',
            'x-forwarded-proto': 'https',
          },
        }
      ),
      { supabase: mockSupabase() }
    );
    expect(res.headers.get('location')).toBe(
      'https://nham-internal.example.com/en/logging'
    );
  });
});
