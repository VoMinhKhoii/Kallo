import {
  AuthApiError,
  type AuthError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Who `updateSession` lets through, and where it sends everyone else. The
// signed-out case is the KALLO-WEB-2 regression: Back from the landing page
// after signing out reached /en/dashboard with no session, and the page's own
// session read threw before the layout's redirect could run.

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient }));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_key');

const { updateSession } = await import('@/lib/infra/supabase/middleware');

function session(
  user: { id: string } | null,
  error: AuthError | null = null,
  refreshed: { name: string; value: string; maxAge?: number }[] = []
) {
  createServerClient.mockImplementation((_url, _key, options) => ({
    auth: {
      getUser: async () => {
        if (refreshed.length > 0) {
          options.cookies.setAll(
            refreshed.map(({ maxAge, ...c }) => ({
              ...c,
              options: { path: '/', maxAge },
            }))
          );
        }
        return { data: { user }, error };
      },
    },
  }));
}

function run(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return updateSession(new NextRequest(`https://kallo.fit${path}`, init));
}

async function location(path: string) {
  const header = (await run(path)).headers.get('location');
  return header ? new URL(header) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signed-out visitor', () => {
  beforeEach(() => session(null));

  it.each([
    '/en/dashboard',
    '/vi/logging',
    '/en/settings/account',
    '/en/activity',
  ])('is sent from %s to the sign-in dialog with a way back', async (path) => {
    const response = await run(path);
    const url = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(307);
    expect(url.pathname).toBe(`/${path.split('/')[1]}`);
    expect(url.searchParams.get('auth')).toBe('sign-in');
    expect(url.searchParams.get('next')).toBe(path);
  });

  it('keeps the query on the way back', async () => {
    const url = await location('/en/logging?date=2026-10-05&meal=abc');

    expect([...(url?.searchParams.keys() ?? [])]).toEqual(['auth', 'next']);
    expect(url?.searchParams.get('next')).toBe(
      '/en/logging?date=2026-10-05&meal=abc'
    );
  });

  it('falls back to the bare path when the query is not a safe next', async () => {
    const url = await location('/en/logging?tag=a:b');
    expect(url?.searchParams.get('next')).toBe('/en/logging');
  });

  it('omits next when even the path is not a safe next', async () => {
    const url = await location('/en/circle/ab:cd');

    expect(url?.searchParams.get('auth')).toBe('sign-in');
    expect(url?.searchParams.has('next')).toBe(false);
  });

  it('matches a percent-encoded spelling of a private path', async () => {
    const url = await location('/en/%64ashboard');
    expect(url?.searchParams.get('auth')).toBe('sign-in');
  });

  it('carries cleared session cookies onto the redirect', async () => {
    session(null, null, [
      { name: 'sb-project-auth-token', value: '', maxAge: 0 },
    ]);
    const response = await run('/en/dashboard');

    expect(response.status).toBe(307);
    const header = response.headers.get('set-cookie') ?? '';
    expect(header).toContain('sb-project-auth-token=;');
    expect(header).toContain('Max-Age=0');
  });

  it('leaves /admin to its 404 rather than naming it', async () => {
    expect(await location('/en/admin/prompts')).toBeNull();
  });

  it('leaves a Server Action POST to the action', async () => {
    const response = await run('/en/logging', {
      method: 'POST',
      headers: { 'next-action': 'abc123' },
    });
    expect(response.headers.get('location')).toBeNull();
  });

  it.each([
    ['/en'],
    ['/en/pricing'],
    ['/en/invite/abc'],
    ['/en/dashboards'],
    ['/dashboard'],
  ])('passes through %s', async (path) => {
    expect(await location(path)).toBeNull();
  });

  it.each([
    new AuthRetryableFetchError('fetch failed', 0),
    new AuthApiError('unavailable', 503, undefined),
    new AuthApiError('rate limited', 429, 'over_request_rate_limit'),
    new AuthUnknownError('bad json', new Error('parse')),
    new AuthApiError('Invalid API key', 401, undefined),
  ])('does not treat a Supabase outage ($name $status) as signed out', async (error) => {
    session(null, error);
    expect(await location('/en/dashboard')).toBeNull();
  });

  it.each([
    new AuthSessionMissingError(),
    new AuthApiError('bad jwt', 403, 'bad_jwt'),
    new AuthApiError('gone', 400, 'refresh_token_not_found'),
  ])('treats $name $status as signed out', async (error) => {
    session(null, error);
    expect((await run('/en/dashboard')).status).toBe(307);
  });
});

describe('signed-in visitor', () => {
  beforeEach(() => session({ id: 'user-1' }));

  it('reaches an app surface', async () => {
    expect(await location('/en/dashboard')).toBeNull();
  });

  it('is sent from the landing page to logging, keeping the query', async () => {
    const url = await location('/vi?date=2026-10-05');
    expect(url?.pathname).toBe('/vi/logging');
    expect(url?.searchParams.get('date')).toBe('2026-10-05');
  });

  it('is sent from the landing page to the page sign-in was holding', async () => {
    const url = await location(
      '/en?auth=sign-in&next=%2Fen%2Fsettings%2Faccount'
    );
    expect(url?.href).toBe('https://kallo.fit/en/settings/account');
  });

  it('ignores an unsafe next on the landing page', async () => {
    const url = await location('/en?next=%2F%2Fevil.example');
    expect(url?.pathname).toBe('/en/logging');
  });

  it('leaves the bare root to next-intl so the locale is negotiated', async () => {
    expect(await location('/')).toBeNull();
  });
});
