import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileState } from '@/hooks/auth/use-turnstile';
import { CodeStep } from '../code-step';

const verifyOtp = vi.fn();
const signInWithOtp = vi.fn();
const closeDialog = vi.fn();
const showAuth = vi.fn();
const push = vi.fn();
const reset = vi.fn();
let next: string | null;
let turnstile: TurnstileState;

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    codeEmail: 'khoi@example.com',
    next,
    closeDialog,
    showAuth,
    turnstileSiteKey: 'site-key',
  }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({ auth: { verifyOtp, signInWithOtp } }),
}));

vi.mock('@/hooks/auth/use-turnstile', () => ({
  useTurnstile: () => turnstile,
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const codeField = () => screen.getByRole('textbox');

beforeEach(() => {
  vi.clearAllMocks();
  next = null;
  turnstile = {
    containerRef: { current: null },
    token: 'tok-2',
    required: true,
    failed: false,
    interactive: false,
    reset,
  };
  verifyOtp.mockResolvedValue({ data: {}, error: null });
  signInWithOtp.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CodeStep', () => {
  it('verifies a code that arrives whole by itself and opens the app', async () => {
    render(<CodeStep />);

    // A paste, or the browser's one-time-code fill, lands the code at once —
    // spaces and dashes from the email included.
    fireEvent.change(codeField(), { target: { value: '305 805' } });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/logging'));
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'khoi@example.com',
      token: '305805',
      type: 'email',
    });
    expect(closeDialog).toHaveBeenCalled();
  });

  it("takes the project's code length, whatever it is (6–10 digits)", async () => {
    render(<CodeStep />);

    fireEvent.change(codeField(), { target: { value: '12345678' } });

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token: '12345678' })
      )
    );
  });

  it('never submits a typed code early: Continue sends it', async () => {
    render(<CodeStep />);
    const verifyButton = screen.getByRole('button', { name: 'verify' });

    // Digit by digit, as a person types an 8-digit code.
    let typed = '';
    for (const digit of '1234567') {
      typed += digit;
      fireEvent.change(codeField(), { target: { value: typed } });
      if (typed.length < 6) expect(verifyButton).toBeDisabled();
    }
    expect(verifyOtp).not.toHaveBeenCalled();

    fireEvent.change(codeField(), { target: { value: '12345678' } });
    expect(verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(verifyButton);

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ token: '12345678' })
      )
    );
  });

  it('says a wrong or expired code plainly and stays put', async () => {
    verifyOtp.mockResolvedValue({
      data: {},
      error: {
        message: 'Token has expired or is invalid',
        code: 'otp_expired',
        status: 403,
      },
    });
    render(<CodeStep />);

    fireEvent.change(codeField(), { target: { value: '111111' } });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('errors.invalidCode')
    );
    expect(closeDialog).not.toHaveBeenCalled();
  });

  it('returns to an invite link with a hard navigation', async () => {
    next = '/vi/invite/khoi';
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<CodeStep />);

    fireEvent.change(codeField(), { target: { value: '305805' } });

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/vi/invite/khoi'));
    vi.unstubAllGlobals();
  });

  it('holds "send a new code" for the 60 s cooldown, then resends with a fresh token', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CodeStep />);
    const resend = screen.getByRole('button', { name: 'resendIn' });
    expect(resend).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    const ready = screen.getByRole('button', { name: 'resend' });
    expect(ready).toBeEnabled();

    await act(async () => {
      ready.click();
    });

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'khoi@example.com',
        options: expect.objectContaining({ captchaToken: 'tok-2' }),
      })
    );
    expect(reset).toHaveBeenCalled();
    expect(screen.getByText('resent')).toBeInTheDocument();
  });

  it('goes back to the email step', () => {
    render(<CodeStep />);

    screen.getByRole('button', { name: 'back' }).click();

    expect(showAuth).toHaveBeenCalled();
  });
});
