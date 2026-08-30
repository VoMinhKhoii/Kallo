import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainSidebar } from '../main-sidebar';

const { unseenCountMock } = vi.hoisted(() => ({
  unseenCountMock: vi.fn(() => 0),
}));

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

// The nav's invite-count badge is out of scope here; stub it so the component
// doesn't require a QueryClientProvider.
vi.mock('@/hooks/social/sharing/use-meal-share-invites', () => ({
  useMealShareInviteCount: () => 0,
}));

// Activity badge — same reason as the invite count above, but drivable: the
// rail dots the Activity row from it.
vi.mock('@/hooks/notifications/use-notification-badge', () => ({
  useUnseenNotificationCount: () => unseenCountMock(),
}));

describe('MainSidebar (back-compat re-export of DesktopSidebar)', () => {
  it('renders the nutrition link, not tracking', () => {
    render(
      <MainSidebar
        user={{
          email: 'tester@example.com',
          displayName: null,
          avatarUrl: null,
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'nutrition' })).toHaveAttribute(
      'href',
      '/nutrition'
    );
    expect(
      screen.queryByRole('link', { name: 'tracking' })
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('a[href="/tracking"]')
    ).not.toBeInTheDocument();
  });

  it('renders the current user identity instead of a hard-coded account', () => {
    render(
      <MainSidebar userDisplayName="Khoi Vo" userEmail="khoi@example.com" />
    );

    expect(screen.getByText('Khoi Vo')).toBeInTheDocument();
    expect(screen.getByText('khoi@example.com')).toBeInTheDocument();
    expect(screen.queryByText('VMKHOIII')).not.toBeInTheDocument();
    expect(screen.queryByText('minhkhoitdn@gmail.com')).not.toBeInTheDocument();
  });

  it('badges the activity row only while notifications are unseen', () => {
    const quiet = render(<MainSidebar />);
    expect(
      quiet.container.querySelectorAll('a[href="/activity"] .bg-kallo-accent')
    ).toHaveLength(0);
    quiet.unmount();

    unseenCountMock.mockReturnValue(2);
    const badged = render(<MainSidebar />);

    expect(
      badged.container.querySelectorAll('a[href="/activity"] .bg-kallo-accent')
    ).toHaveLength(1);
  });
});
