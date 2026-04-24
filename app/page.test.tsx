import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieGetMock, getOnboardingProfileMock, getUserMock, redirectMock } =
  vi.hoisted(() => ({
    cookieGetMock: vi.fn(),
    getOnboardingProfileMock: vi.fn(),
    getUserMock: vi.fn(),
    redirectMock: vi.fn(),
  }));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/onboarding/actions', () => ({
  getOnboardingProfile: getOnboardingProfileMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

import RootPage from './page';

describe('RootPage', () => {
  beforeEach(() => {
    cookieGetMock.mockReset();
    getOnboardingProfileMock.mockReset();
    getUserMock.mockReset();
    redirectMock.mockReset();

    cookieGetMock.mockReturnValue(undefined);
    getOnboardingProfileMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({
      data: { user: null },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects authenticated users to their saved profile locale', async () => {
    cookieGetMock.mockReturnValue({ value: 'en' });
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    getOnboardingProfileMock.mockResolvedValue({
      preferredLocale: 'vi',
    });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith('/vi');
  });

  it('falls back to the locale cookie for unauthenticated users', async () => {
    cookieGetMock.mockReturnValue({ value: 'vi' });

    await RootPage();

    expect(getOnboardingProfileMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/vi');
  });

  it('falls back to the default locale when the cookie is invalid', async () => {
    cookieGetMock.mockReturnValue({ value: 'fr' });

    await RootPage();

    expect(redirectMock).toHaveBeenCalledWith('/en');
  });

  it('logs and falls back when profile loading fails', async () => {
    const error = new Error('boom');
    const consoleErrorMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    cookieGetMock.mockReturnValue({ value: 'en' });
    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    getOnboardingProfileMock.mockRejectedValue(error);

    await RootPage();

    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Failed to load onboarding profile:',
      error
    );
    expect(redirectMock).toHaveBeenCalledWith('/en');
  });
});
