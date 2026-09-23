import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetUser, mockRedirect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const { SignedInRedirect } = await import('../signed-in-redirect');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignedInRedirect', () => {
  it('sends a signed-in visitor with no intent into the app', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    await SignedInRedirect({ searchParams: Promise.resolve({}) });

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('leaves a signed-out visitor on the landing page', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await SignedInRedirect({ searchParams: Promise.resolve({}) });

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // An invite link lands here with ?auth=/?next= and must reach the dialog.
  it('does not redirect, or even read the session, on an auth intent', async () => {
    await SignedInRedirect({
      searchParams: Promise.resolve({ auth: 'sign-in' }),
    });

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
