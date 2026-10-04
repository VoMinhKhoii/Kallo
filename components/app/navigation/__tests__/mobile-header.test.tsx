import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileHeader } from '../mobile-header';

const mocks = vi.hoisted(() => ({
  pathname: vi.fn(() => '/dashboard'),
  unseen: vi.fn(() => 0),
  createClient: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => mocks.pathname(),
}));
vi.mock('@/hooks/notifications/use-notification-badge', () => ({
  useUnseenNotificationCount: () => mocks.unseen(),
}));
// The account sheet's dialog form — see mobile-tab-bar.test.tsx.
vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: mocks.createClient,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

const user = {
  email: 'minh@example.com',
  displayName: 'Minh',
  avatarUrl: null,
};

describe('MobileHeader', () => {
  beforeEach(() => {
    mocks.pathname.mockReturnValue('/dashboard');
    mocks.unseen.mockReturnValue(0);
    mocks.createClient.mockReset();
    mocks.toastError.mockReset();
  });

  it('shows the Kallo wordmark on Today only, like the Flutter header', () => {
    const { container, unmount } = render(<MobileHeader user={user} />);
    expect(container.querySelector('header svg')).not.toBeNull();
    unmount();

    mocks.pathname.mockReturnValue('/nutrition');
    const other = render(<MobileHeader user={user} />);
    expect(
      other.container.querySelector('header > div:first-child')
    ).toBeEmptyDOMElement();
  });

  it('keeps the activity heart and the centered portal slot', () => {
    const { container } = render(<MobileHeader user={user} />);

    expect(screen.getByRole('link', { name: 'mobileButton' })).toHaveAttribute(
      'href',
      '/activity'
    );
    expect(
      container.querySelector('#app-mobile-header-slot')
    ).toBeInTheDocument();
  });

  it('dots the heart only while notifications are unseen', () => {
    const { container, unmount } = render(<MobileHeader user={user} />);
    expect(container.querySelectorAll('.bg-kallo-accent')).toHaveLength(0);
    unmount();

    mocks.unseen.mockReturnValue(3);
    const withBadge = render(<MobileHeader user={user} />);
    expect(
      withBadge.container.querySelectorAll('.bg-kallo-accent')
    ).toHaveLength(1);
  });

  it('opens the account sheet with Settings, and Admin only for admins', async () => {
    const u = userEvent.setup();
    const { unmount } = render(<MobileHeader user={user} />);
    await u.click(screen.getByRole('button', { name: 'openMenu' }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Minh')).toBeInTheDocument();
    expect(
      within(sheet).getByRole('link', { name: 'settings' })
    ).toHaveAttribute('href', '/settings');
    expect(
      within(sheet).queryByRole('link', { name: 'admin' })
    ).not.toBeInTheDocument();
    unmount();

    render(<MobileHeader user={user} isAdmin />);
    await u.click(screen.getByRole('button', { name: 'openMenu' }));
    expect(
      within(await screen.findByRole('dialog')).getByRole('link', {
        name: 'admin',
      })
    ).toHaveAttribute('href', '/admin');
  });

  it('reports a sign-out failure via toast and re-enables the button', async () => {
    const u = userEvent.setup();
    const signOut = vi
      .fn()
      .mockResolvedValue({ error: new Error('sign-out failed') });
    mocks.createClient.mockReturnValue({ auth: { signOut } });
    render(<MobileHeader user={user} />);
    await u.click(screen.getByRole('button', { name: 'openMenu' }));

    const button = within(await screen.findByRole('dialog')).getByRole(
      'button',
      { name: 'signOut' }
    );
    await u.click(button);

    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('signOutError');
      expect(button).not.toBeDisabled();
    });
  });
});
