import { describe, expect, it, vi } from 'vitest';

const createBrowserClient = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient,
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');

const { createClient } = await import('@/lib/supabase/client');

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
});
