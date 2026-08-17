import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GoogleIdConfiguration,
  GoogleIdentityApi,
} from '@/lib/infra/auth/google-identity';
import { GoogleSignInButton } from './google-sign-in-button';

const signInWithIdTokenMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const loadGoogleIdentityMock = vi.fn();

let googleClientId: string | null = 'client-123.apps.googleusercontent.com';

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    next: null,
    googleClientId,
    closeDialog: vi.fn(),
  }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: signInWithIdTokenMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}));

vi.mock('@/lib/infra/auth/google-identity', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/infra/auth/google-identity')>();
  // Referenced lazily: vi.mock factories are hoisted above the consts above.
  return { ...actual, loadGoogleIdentity: () => loadGoogleIdentityMock() };
});

vi.mock('@/hooks/ui/use-in-app-browser', () => ({
  useIsInAppBrowser: () => false,
}));

vi.mock('@/lib/infra/platform/in-app-browser', () => ({
  isInAppBrowser: () => false,
  isAndroid: () => false,
  chromeIntentUrl: (url: string) => url,
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

/**
 * A stand-in for `window.google.accounts.id` that behaves the way GIS does:
 * `renderButton` puts a real `[role="button"]` in the container, and clicking
 * it delivers a credential to the callback registered by `initialize`.
 */
function fakeGoogleIdentity(): GoogleIdentityApi & {
  config: GoogleIdConfiguration | null;
} {
  const api = {
    config: null as GoogleIdConfiguration | null,
    initialize: (config: GoogleIdConfiguration) => {
      api.config = config;
    },
    renderButton: (parent: HTMLElement) => {
      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      button.tabIndex = 0;
      button.addEventListener('click', () => {
        api.config?.callback({ credential: 'google-id-token' });
      });
      parent.appendChild(button);
    },
    cancel: vi.fn(),
  };
  return api;
}

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    googleClientId = 'client-123.apps.googleusercontent.com';
    signInWithIdTokenMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
  });

  it('signs in with the ID token GIS mints on our own origin', async () => {
    // The point of the whole flow: no redirect through
    // <project-ref>.supabase.co/auth/v1/authorize, so Google's picker is
    // labelled with our domain instead of the Supabase one.
    const google = fakeGoogleIdentity();
    loadGoogleIdentityMock.mockResolvedValue(google);

    render(<GoogleSignInButton />);
    await waitFor(() => expect(google.config).not.toBeNull());

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(signInWithIdTokenMock).toHaveBeenCalled());
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    const [args] = signInWithIdTokenMock.mock.calls.at(-1) ?? [];
    expect(args).toMatchObject({
      provider: 'google',
      token: 'google-id-token',
    });
    // Supabase re-hashes the raw nonce and compares it with the token claim,
    // so what Google was given must be the hash of what Supabase is given.
    expect(google.config?.nonce).toBe(await sha256Hex(args.nonce));
  });

  it('recovers the button when the token exchange throws', async () => {
    // Supabase rethrows anything that isn't an AuthError, and `createClient()`
    // throws outright on a missing project URL. GIS calls us from a callback,
    // so an unhandled rejection would strand the spinner with no message.
    const google = fakeGoogleIdentity();
    loadGoogleIdentityMock.mockResolvedValue(google);
    signInWithIdTokenMock.mockRejectedValue(new Error('network down'));

    render(<GoogleSignInButton />);
    await waitFor(() => expect(google.config).not.toBeNull());

    const button = screen.getByRole('button');
    await userEvent.click(button);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('keeps the invisible Google button out of the tab order', async () => {
    // It sits inside the auth dialog's focus trap; left focusable, Tab would
    // land keyboard users on a control they cannot see.
    const google = fakeGoogleIdentity();
    loadGoogleIdentityMock.mockResolvedValue(google);

    const { container } = render(<GoogleSignInButton />);

    await waitFor(() =>
      expect(container.querySelector('[role="button"]')).not.toBeNull()
    );
    expect(
      container.querySelector<HTMLElement>('[role="button"]')?.tabIndex
    ).toBe(-1);
  });

  it('falls back to the redirect flow when GIS is blocked', async () => {
    // Ad blockers and locked-down networks kill accounts.google.com outright.
    // Sign-in must still work — it just shows the Supabase consent domain.
    loadGoogleIdentityMock.mockRejectedValue(new Error('blocked'));

    render(<GoogleSignInButton />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(signInWithOAuthMock).toHaveBeenCalled());
    expect(signInWithIdTokenMock).not.toHaveBeenCalled();
  });

  it('falls back to the redirect flow when no client ID is configured', async () => {
    googleClientId = null;
    loadGoogleIdentityMock.mockResolvedValue(fakeGoogleIdentity());

    render(<GoogleSignInButton />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(signInWithOAuthMock).toHaveBeenCalled());
    expect(loadGoogleIdentityMock).not.toHaveBeenCalled();
  });
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
