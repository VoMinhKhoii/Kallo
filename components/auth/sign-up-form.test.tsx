import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignUpForm } from './sign-up-form';

const closeDialogMock = vi.fn();
const signUpMock = vi.fn();

vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({
    closeDialog: closeDialogMock,
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
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

  it('shows success feedback and closes the dialog after sign-up', async () => {
    signUpMock.mockResolvedValue({ error: null });

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
      expect(toast.success).toHaveBeenCalledWith('success');
      expect(closeDialogMock).toHaveBeenCalled();
    });
  });
});
