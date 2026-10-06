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

function signedIn(
  user: { id: string } | null,
  error: { name: string; status?: number } | null = null
) {
  createServerClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user }, error }) },
  });
}

function run(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return updateSession(new NextRequest(`https://kallo.fit${path}`, init));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signed-out visitor', () => {
  beforeEach(() => signedIn(null));

  it.each([
    '/en/dashboard',
    '/vi/logging',
    '/en/settings/account',
    '/en/activity',
  ])('is sent from %s to the sign-in dialog with a way back', async (path) => {
    const response = await run(path);
    const location = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(307);
    expect(location.pathname).toBe(`/${path.split('/')[1]}`);
    expect(location.searchParams.get('auth')).toBe('sign-in');
    expect(location.searchParams.get('next')).toBe(path);
  });

  it('keeps the query on the way back', async () => {
    const response = await run('/en/logging?date=2026-10-05&meal=abc');
    const location = new URL(response.headers.get('location') ?? '');

    expect([...location.searchParams.keys()]).toEqual(['auth', 'next']);
    expect(location.searchParams.get('next')).toBe(
      '/en/logging?date=2026-10-05&meal=abc'
    );
  });

  it('falls back to the bare path when the query is not a safe next', async () => {
    const response = await run('/en/logging?tag=a:b');
    const location = new URL(response.headers.get('location') ?? '');

    expect(location.searchParams.get('next')).toBe('/en/logging');
  });

  it('leaves /admin to its 404 rather than naming it', async () => {
    const response = await run('/en/admin/prompts');
    expect(response.headers.get('location')).toBeNull();
  });

  it('leaves a Server Action POST to the action', async () => {
    const response = await run('/en/logging', {
      method: 'POST',
      headers: { 'next-action': 'abc123' },
    });
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not treat a Supabase outage as signed out', async () => {
    signedIn(null, { name: 'AuthRetryableFetchError', status: 0 });
    expect((await run('/en/dashboard')).headers.get('location')).toBeNull();

    signedIn(null, { name: 'AuthApiError', status: 503 });
    expect((await run('/en/dashboard')).headers.get('location')).toBeNull();
  });

  it('treats a missing or rejected session as signed out', async () => {
    signedIn(null, { name: 'AuthSessionMissingError', status: 400 });
    expect((await run('/en/dashboard')).status).toBe(307);

    signedIn(null, { name: 'AuthApiError', status: 403 });
    expect((await run('/en/dashboard')).status).toBe(307);
  });

  it.each([
    '/en',
    '/en/pricing',
    '/en/invite/abc',
    '/dashboard',
  ])('passes through %s', async (path) => {
    const response = await run(path);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not treat a lookalike prefix as private', async () => {
    const response = await run('/en/dashboards');
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('signed-in visitor', () => {
  beforeEach(() => signedIn({ id: 'user-1' }));

  it('reaches an app surface', async () => {
    const response = await run('/en/dashboard');
    expect(response.headers.get('location')).toBeNull();
  });

  it('is sent from the landing page to logging', async () => {
    const response = await run('/vi');
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
      '/vi/logging'
    );
  });
});
