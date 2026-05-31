import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteAccept } from './invite-accept';

const pushMock = vi.fn();
const mutateMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/hooks/use-invite', () => ({
  useAcceptInvite: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('InviteAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts with the inviter slug and routes into the circle on success', async () => {
    render(<InviteAccept slug="pho4821" />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'accept' }));

    expect(mutateMock).toHaveBeenCalledWith('pho4821', expect.any(Object));
    // Drive the success callback the component handed to the mutation.
    mutateMock.mock.calls[0][1].onSuccess();
    expect(pushMock).toHaveBeenCalledWith('/groups');
  });

  it('surfaces an error toast when accepting fails', async () => {
    render(<InviteAccept slug="pho4821" />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'accept' }));

    mutateMock.mock.calls[0][1].onError();
    expect(toast.error).toHaveBeenCalledWith('error');
  });
});
