import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '../sign-in-form';

const signInMock = vi.fn();

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    closeDialog: vi.fn(),
    showForgot: vi.fn(),
    next: null,
  }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword: signInMock } }),
}));

async function submit() {
  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText('emailPlaceholder'),
    'khoi@example.com'
  );
  await user.type(
    screen.getByPlaceholderText('passwordPlaceholder'),
    'hunter22'
  );
  await user.click(screen.getByRole('button', { name: 'submit' }));
}

describe('SignInForm error copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // "Invalid email or password" for a THROTTLE is the worst copy available: it
  // tells someone with the right password that their password is wrong, so they
  // retype it and get throttled harder.
  it.each([
    ['the GoTrue error code', { code: 'over_request_rate_limit', status: 429 }],
    ['a bare 429 with no code', { status: 429 }],
  ])('shows the rate-limited line for %s', async (_name, error) => {
    signInMock.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials', ...error },
    });

    render(<SignInForm />);
    await submit();

    await waitFor(() => {
      expect(screen.getByText('errors.rateLimited')).toBeInTheDocument();
    });
  });

  it('still shows the neutral line for a real credential failure', async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: {
        message: 'Invalid login credentials',
        code: 'invalid_credentials',
        status: 400,
      },
    });

    render(<SignInForm />);
    await submit();

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument();
    });
    expect(screen.queryByText('errors.rateLimited')).not.toBeInTheDocument();
  });

  it('keeps the unconfirmed-email special case', async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: { message: 'Email not confirmed', status: 400 },
    });

    render(<SignInForm />);
    await submit();

    await waitFor(() => {
      expect(screen.getByText('errorUnconfirmed')).toBeInTheDocument();
    });
  });
});
