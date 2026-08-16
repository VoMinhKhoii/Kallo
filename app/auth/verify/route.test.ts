import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const { handleVerify } = await import('@/app/auth/verify/route');

function mockSupabase(error?: { message: string } | null) {
  return {
    auth: {
      verifyOtp: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: error ?? null }),
    },
  } as unknown as Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createClient>
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

  it('uses x-forwarded-host + proto behind a reverse proxy', async () => {
    const res = await handleVerify(
      makeRequest(
        { token_hash: 'hash123', type: 'email' },
        {
          url: 'http://0.0.0.0:8080/auth/verify',
          headers: {
            host: '0.0.0.0:8080',
            'x-forwarded-host': 'kallo-internal.example.com',
            'x-forwarded-proto': 'https',
          },
        }
      ),
      { supabase: mockSupabase() }
    );
    expect(res.headers.get('location')).toBe(
      'https://kallo-internal.example.com/en/logging'
    );
  });
});
