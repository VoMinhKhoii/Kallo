import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/infra/supabase/cookie-options';

const createBrowserClient = vi.fn();

vi.mock('@supabase/ssr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@supabase/ssr')>()),
  createBrowserClient,
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');

const { createClient } = await import('@/lib/infra/supabase/client');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv('NODE_ENV', 'test');
});

function latestOptions() {
  const [, , options] = createBrowserClient.mock.calls.at(-1) ?? [];
  return options;
}

describe('createClient', () => {
  it('points the browser client at the same-origin auth proxy', () => {
    createClient();

    expect(createBrowserClient).toHaveBeenCalledWith(
      `${window.location.origin}/api/supabase-proxy`,
      'sb_publishable_key',
      expect.anything()
    );
  });

  it('pins the auth cookie name to the key derived from the real Supabase URL', () => {
    // The browser client rides the proxy origin, but the middleware/server
    // clients stay on the real Supabase URL — from which supabase-js derives
    // the cookie name `sb-<first-label>-auth-token`. Pinning cookieOptions.name
    // keeps both sides on the same cookie so signOut() actually clears the
    // session the middleware reads. https://…/api/supabase-proxy would
    // otherwise derive `sb-<app-host>-auth-token` and orphan the server cookie.
    createClient();

    const [, , options] = createBrowserClient.mock.calls.at(-1) ?? [];
    expect(options?.cookieOptions?.name).toBe('sb-project-auth-token');
  });

  it('marks the session cookie Secure in production (KALLO-06)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    createClient();

    expect(latestOptions()?.cookieOptions).toMatchObject({
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it('marks the session cookie Secure on any https page', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubGlobal('location', { ...window.location, protocol: 'https:' });
    createClient();

    expect(latestOptions()?.cookieOptions?.secure).toBe(true);
  });

  it('writes every cookie with Secure and the shared Max-Age, not the 400-day default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    createClient();
    const writes: string[] = [];
    const setter = vi
      .spyOn(document, 'cookie', 'set')
      .mockImplementation((value) => {
        writes.push(value);
      });

    latestOptions()?.cookies.setAll([
      {
        name: 'sb-project-auth-token.0',
        value: 'chunk',
        options: { path: '/', maxAge: 400 * 24 * 60 * 60 },
      },
    ]);
    setter.mockRestore();

    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain('Secure');
    expect(writes[0]).toContain('SameSite=Lax');
    expect(writes[0]).toContain(`Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
  });
});
