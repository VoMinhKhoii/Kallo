import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPanel } from './connect-panel';

const mutateMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('@/hooks/social/circle/use-invite', () => ({
  useAcceptInvite: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('ConnectPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts with the inviter slug', async () => {
    render(<ConnectPanel slug="pho4821" inviterLabel="An" youLabel="Bình" />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'accept' }));

    expect(mutateMock).toHaveBeenCalledWith('pho4821', expect.any(Object));
  });

  it('resolves in place on success — no navigation, shows connected state', async () => {
    render(<ConnectPanel slug="pho4821" inviterLabel="An" youLabel="Bình" />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'accept' }));

    // Drive the success callback the panel handed to the mutation.
    mutateMock.mock.calls[0][1].onSuccess();

    expect(await screen.findByText('connectedTitle')).toBeInTheDocument();
    expect(screen.getByText('goToCircle')).toBeInTheDocument();
    // The Accept button is gone — we did not teleport, we resolved in place.
    expect(
      screen.queryByRole('button', { name: 'accept' })
    ).not.toBeInTheDocument();
  });

  it('surfaces an error toast when accepting fails', async () => {
    render(<ConnectPanel slug="pho4821" inviterLabel="An" youLabel="Bình" />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'accept' }));

    mutateMock.mock.calls[0][1].onError();
    expect(toast.error).toHaveBeenCalledWith('error');
  });
});
