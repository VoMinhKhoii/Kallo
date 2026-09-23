import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/infra/supabase/cookie-options';

// The server client and the middleware must write the session cookie with the
// exact attributes the browser client uses (KALLO-06), and must undo
// @supabase/ssr's forced 400-day maxAge in their setAll.

const { createServerClient, mockCookieStore, mockHeaders } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  mockCookieStore: { getAll: vi.fn(() => []), set: vi.fn() },
  mockHeaders: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient }));
vi.mock('next/headers', () => ({
  cookies: async () => mockCookieStore,
  headers: mockHeaders,
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');
// jsdom gives this file a `window` on http://localhost, which a real server
// never has; production pins Secure regardless, as it does on Cloud Run.
vi.stubEnv('NODE_ENV', 'production');

const { createClient } = await import('@/lib/infra/supabase/server');
const { updateSession } = await import('@/lib/infra/supabase/middleware');

const SUPABASE_DEFAULT_MAX_AGE = 400 * 24 * 60 * 60;
const refreshedChunk = {
  name: 'sb-project-auth-token.0',
  value: 'chunk',
  options: {
    path: '/',
    sameSite: 'lax' as const,
    maxAge: SUPABASE_DEFAULT_MAX_AGE,
  },
};

function latestOptions() {
  const [, , options] = createServerClient.mock.calls.at(-1) ?? [];
  return options;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHeaders.mockResolvedValue(new Headers());
  createServerClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user: null } }) },
  });
});

describe('server client session cookie', () => {
  it('uses the shared session cookie options', async () => {
    await createClient();
    expect(latestOptions()?.cookieOptions).toEqual(sessionCookieOptions());
  });

  it('writes refreshed chunks Secure with the shared Max-Age', async () => {
    await createClient();
    latestOptions()?.cookies.setAll([refreshedChunk]);

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      refreshedChunk.name,
      'chunk',
      expect.objectContaining({
        secure: true,
        maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      })
    );
  });

  it('keeps the Bearer path cookieless', async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ authorization: 'Bearer token' })
    );
    await createClient();
    expect(latestOptions()?.cookieOptions).toBeUndefined();
  });
});

describe('middleware session cookie', () => {
  it('uses the shared session cookie options', async () => {
    await updateSession(new NextRequest('https://kallo.fit/en/logging'));
    expect(latestOptions()?.cookieOptions).toEqual(sessionCookieOptions());
  });

  it('writes refreshed chunks Secure with the shared Max-Age', async () => {
    let setAll: ((c: (typeof refreshedChunk)[]) => void) | undefined;
    createServerClient.mockImplementation((_url, _key, options) => {
      setAll = options.cookies.setAll;
      return {
        auth: {
          getUser: async () => {
            setAll?.([refreshedChunk]);
            return { data: { user: null } };
          },
        },
      };
    });

    const response = await updateSession(
      new NextRequest('https://kallo.fit/en/logging')
    );
    const header = response.headers.get('set-cookie') ?? '';

    expect(header).toContain('sb-project-auth-token.0=chunk');
    expect(header).toContain(`Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
    expect(header.toLowerCase()).toContain('secure');
    expect(header.toLowerCase()).toContain('samesite=lax');
  });
});
