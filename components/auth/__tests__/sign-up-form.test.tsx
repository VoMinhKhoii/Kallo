import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUpForm } from '../sign-up-form';

const closeDialogMock = vi.fn();
const showCheckEmailMock = vi.fn();
const signUpMock = vi.fn();

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    closeDialog: closeDialogMock,
    showCheckEmail: showCheckEmailMock,
    next: null,
  }),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: signUpMock,
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('holds on the check-your-email panel after a confirmation sign-up', async () => {
    // No session in the response → email confirmation is enabled.
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    render(<SignUpForm />);

    const user = userEvent.setup();

    await user.type(
      screen.getByPlaceholderText('emailPlaceholder'),
      'new@example.com'
    );
    await user.type(
      screen.getByPlaceholderText('passwordPlaceholder'),
      'hunter22'
    );
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'hunter22',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback?next='),
        },
      });
    });

    await waitFor(() => {
      expect(showCheckEmailMock).toHaveBeenCalledWith(
        'new@example.com',
        'confirm'
      );
    });
    // The dialog stays open on the persistent check-email panel; no vanishing
    // success toast.
    expect(closeDialogMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
