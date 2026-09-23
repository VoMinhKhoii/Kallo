import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE_MAX_AGE_SECONDS } from '@/lib/infra/supabase/cookie-options';

// Runs the REAL @supabase/ssr browser storage (no mock) to prove the shared
// attributes reach every chunk the library writes on a token refresh, and that
// its hard-coded 400-day maxAge (0.8 `setCookieOptions`) no longer wins.

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');
vi.stubEnv('NODE_ENV', 'production');

const { createClient } = await import('@/lib/infra/supabase/client');

afterEach(() => {
  vi.restoreAllMocks();
});

interface AuthStorage {
  setItem(key: string, value: string): Promise<void>;
}

describe('browser session cookie chunks (KALLO-06)', () => {
  it('writes .0/.1 chunks with Secure, SameSite=Lax, Path=/ and the shared Max-Age', async () => {
    const client = createClient();
    const writes: string[] = [];
    vi.spyOn(document, 'cookie', 'set').mockImplementation((value) => {
      writes.push(value);
    });

    // A session large enough to be split across several cookies, written the
    // way GoTrueClient persists a refreshed session.
    const storage = (client.auth as unknown as { storage: AuthStorage })
      .storage;
    await storage.setItem(
      'sb-project-auth-token',
      JSON.stringify({ access_token: 'x'.repeat(6000) })
    );

    const chunkWrites = writes.filter((w) =>
      /^sb-project-auth-token\.\d=/.test(w)
    );
    expect(chunkWrites.map((w) => w.split('=')[0])).toEqual(
      expect.arrayContaining([
        'sb-project-auth-token.0',
        'sb-project-auth-token.1',
      ])
    );
    for (const write of chunkWrites) {
      expect(write).toContain(`Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
      expect(write).toContain('Secure');
      expect(write).toContain('SameSite=Lax');
      expect(write).toContain('Path=/');
      expect(write).not.toContain('HttpOnly');
    }
  });
});
