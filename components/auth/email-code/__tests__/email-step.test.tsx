import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileState } from '@/hooks/auth/use-turnstile';
import { EmailStep } from '../email-step';

const signInWithOtp = vi.fn();
const showCode = vi.fn();
const reset = vi.fn();
let turnstile: TurnstileState;
let dialog: { next: string | null };

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    next: dialog.next,
    showCode,
    turnstileSiteKey: 'site-key',
  }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithOtp } }),
}));

vi.mock('@/hooks/auth/use-turnstile', () => ({
  useTurnstile: () => turnstile,
}));

function turnstileWith(token: string | null): TurnstileState {
  return {
    containerRef: { current: null },
    token,
    required: true,
    failed: false,
    interactive: false,
    reset,
  };
}

async function submit(email = 'khoi@example.com') {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('emailPlaceholder'), email);
  await user.click(screen.getByRole('button', { name: 'sendCode' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  dialog = { next: null };
  turnstile = turnstileWith('tok-1');
  signInWithOtp.mockResolvedValue({ data: {}, error: null });
});

describe('EmailStep', () => {
  it('asks for a code — creating the account if needed — with the Turnstile token', async () => {
    render(<EmailStep />);
    await submit();

    await waitFor(() =>
      expect(showCode).toHaveBeenCalledWith('khoi@example.com')
    );
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'khoi@example.com',
      options: {
        shouldCreateUser: true,
        // The hook reads the email's language from `next`, and its presence
        // marks a client that can type a code.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fen%2Flogging`,
        captchaToken: 'tok-1',
      },
    });
    // Single-use: the next send needs a fresh one.
    expect(reset).toHaveBeenCalled();
  });

  it('keeps an invite return path in the redirect', async () => {
    dialog = { next: '/vi/invite/khoi' };
    render(<EmailStep />);
    await submit();

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?next=%2Fvi%2Finvite%2Fkhoi`
    );
  });

  it('waits for the security check before it can send', () => {
    turnstile = turnstileWith(null);
    render(<EmailStep />);

    expect(screen.getByRole('button', { name: 'sendCode' })).toBeDisabled();
  });

  // `khoi@example` passes the browser's own type=email check, so this reaches
  // the schema, which wants a real domain.
  it('lets the server decide when the check could not run at all', async () => {
    turnstile = { ...turnstileWith(null), failed: true };
    render(<EmailStep />);
    await submit();

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0][0].options.captchaToken).toBeUndefined();
  });

  it('refuses an invalid address without calling Supabase', async () => {
    render(<EmailStep />);
    await submit('khoi@example');

    await waitFor(() =>
      expect(screen.getByText('emailError')).toBeInTheDocument()
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a throttle',
      { code: 'over_request_rate_limit', status: 429 },
      'errors.rateLimited',
    ],
    [
      'the per-address cooldown',
      { code: 'over_email_send_rate_limit', status: 429 },
      'errors.tooSoon',
    ],
    [
      'a refused Turnstile token',
      { code: 'captcha_failed', status: 400 },
      'errors.captcha',
    ],
    [
      'anything else',
      { code: 'unexpected_failure', status: 500 },
      'errors.generic',
    ],
  ])('maps %s to its own line and stays on the email step', async (_n, error, copy) => {
    signInWithOtp.mockResolvedValue({
      data: {},
      error: { message: 'x', ...error },
    });
    render(<EmailStep />);
    await submit();

    await waitFor(() => expect(screen.getByText(copy)).toBeInTheDocument());
    expect(showCode).not.toHaveBeenCalled();
  });
});
