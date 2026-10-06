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

function signedIn(user: { id: string } | null) {
  createServerClient.mockReturnValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

function run(path: string) {
  return updateSession(new NextRequest(`https://kallo.fit${path}`));
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

  it('drops the original query rather than forwarding it', async () => {
    const response = await run('/en/dashboard?auth=sign-up&x=1');
    const location = new URL(response.headers.get('location') ?? '');

    expect([...location.searchParams.keys()]).toEqual(['auth', 'next']);
    expect(location.searchParams.get('next')).toBe('/en/dashboard');
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
