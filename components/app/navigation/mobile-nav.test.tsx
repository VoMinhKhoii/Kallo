import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileNav } from './mobile-nav';

const { createClientMock, toastErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

// The nav's invite-count badge is out of scope here; stub it so the component
// doesn't require a QueryClientProvider.
vi.mock('@/hooks/social/use-meal-share-invites', () => ({
  useMealShareInviteCount: () => 0,
}));

// Render Sheet primitives inline so the drawer content is queryable without
// having to drive the trigger through Radix's portal-based open animation.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  SheetTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const baseUser = {
  email: 'minh@example.com',
  displayName: 'Minh',
  avatarUrl: null,
};

describe('MobileNav', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders the hamburger button and the standard nav destinations', () => {
    render(<MobileNav user={baseUser} />);

    expect(
      screen.getByRole('button', { name: 'openMenu' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: 'nutrition' })).toHaveAttribute(
      'href',
      '/nutrition'
    );
    expect(screen.getByRole('link', { name: 'logging' })).toHaveAttribute(
      'href',
      '/logging'
    );
    expect(
      screen.queryByRole('link', { name: 'admin' })
    ).not.toBeInTheDocument();
  });

  it('shows the admin destination only when isAdmin is true', () => {
    render(<MobileNav user={baseUser} isAdmin />);

    expect(screen.getByRole('link', { name: 'admin' })).toHaveAttribute(
      'href',
      '/admin'
    );
  });

  it('reports a sign-out failure via toast and re-enables the button', async () => {
    const user = userEvent.setup();
    const signOutMock = vi
      .fn()
      .mockResolvedValue({ error: new Error('sign-out failed') });
    createClientMock.mockReturnValue({ auth: { signOut: signOutMock } });

    render(<MobileNav user={baseUser} />);

    const signOutButton = screen.getByRole('button', { name: 'signOut' });
    await user.click(signOutButton);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('signOutError');
      expect(signOutButton).not.toBeDisabled();
    });
  });
});
