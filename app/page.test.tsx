import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookieGet, mockGetOnboardingProfile, mockGetUser, mockRedirect } =
  vi.hoisted(() => ({
    mockCookieGet: vi.fn(),
    mockGetOnboardingProfile: vi.fn(),
    mockGetUser: vi.fn(),
    mockRedirect: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/lib/domain/onboarding/actions', () => ({
  getOnboardingProfile: mockGetOnboardingProfile,
}));

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

import RootPage from './page';

describe('RootPage', () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockGetOnboardingProfile.mockReset();
    mockGetUser.mockReset();
    mockRedirect.mockReset();

    mockCookieGet.mockReturnValue(undefined);
    mockGetOnboardingProfile.mockResolvedValue(null);
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects authenticated users to their saved profile locale', async () => {
    mockCookieGet.mockReturnValue({ value: 'en' });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockGetOnboardingProfile.mockResolvedValue({
      preferredLocale: 'vi',
    });

    await RootPage();

    expect(mockRedirect).toHaveBeenCalledWith('/vi');
  });

  it('falls back to the locale cookie for unauthenticated users', async () => {
    mockCookieGet.mockReturnValue({ value: 'vi' });

    await RootPage();

    expect(mockGetOnboardingProfile).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/vi');
  });

  it('falls back to the default locale when the cookie is invalid', async () => {
    mockCookieGet.mockReturnValue({ value: 'fr' });

    await RootPage();

    expect(mockRedirect).toHaveBeenCalledWith('/en');
  });

  it('logs and falls back when profile loading fails', async () => {
    const error = new Error('boom');
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockCookieGet.mockReturnValue({ value: 'en' });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockGetOnboardingProfile.mockRejectedValue(error);

    await RootPage();

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to load onboarding profile:',
      error
    );
    expect(mockRedirect).toHaveBeenCalledWith('/en');
  });
});
