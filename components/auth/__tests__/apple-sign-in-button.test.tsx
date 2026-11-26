import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppleSignInButton } from '../apple-sign-in-button';

const signInWithOAuthMock = vi.fn();
let next: string | null = null;

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({ next }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOAuth: signInWithOAuthMock } }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('AppleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    next = null;
  });

  it('starts the Apple redirect flow back to the app', async () => {
    signInWithOAuthMock.mockResolvedValue({ error: null });
    render(<AppleSignInButton />);

    const button = screen.getByRole('button', { name: 'continueWithApple' });
    await userEvent.click(button);

    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/en/logging')}`,
      },
    });
    // The page is leaving for Apple: the spinner stays and no error shows.
    expect(button).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('returns to the invite page when one opened the dialog', async () => {
    next = '/en/invite/abc';
    signInWithOAuthMock.mockResolvedValue({ error: null });
    render(<AppleSignInButton />);

    await userEvent.click(screen.getByRole('button'));

    expect(signInWithOAuthMock.mock.calls[0]?.[0].options.redirectTo).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent('/en/invite/abc')}`
    );
  });

  it.each([
    ['returns an error', () => ({ error: new Error('provider disabled') })],
    [
      'throws',
      () => {
        throw new Error('network');
      },
    ],
  ])('shows an error and re-enables when Supabase %s', async (_, impl) => {
    signInWithOAuthMock.mockImplementation(async () => impl());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppleSignInButton />);

    const button = screen.getByRole('button');
    await userEvent.click(button);

    await waitFor(() => expect(button).toBeEnabled());
    expect(toast.error).toHaveBeenCalledWith('appleError');
  });

  it('clears the spinner when the page comes back from the back-forward cache', async () => {
    signInWithOAuthMock.mockResolvedValue({ error: null });
    render(<AppleSignInButton />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(button).toBeDisabled();

    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent('pageshow', { persisted: true })
      );
    });

    expect(button).toBeEnabled();
  });
});
