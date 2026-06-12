import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomTabBar } from './bottom-tab-bar';

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

// Render Sheet primitives inline so the "You" sheet content is queryable
// without driving Radix's portal-based open animation.
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
}));

const baseUser = { email: 'minh@example.com', displayName: 'Minh' };

describe('BottomTabBar', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders the three primary destinations as tab links', () => {
    render(<BottomTabBar user={baseUser} />);

    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: 'logging' })).toHaveAttribute(
      'href',
      '/logging'
    );
    expect(screen.getByRole('link', { name: 'nutrition' })).toHaveAttribute(
      'href',
      '/nutrition'
    );
  });

  it('exposes Groups, Settings and sign out inside the You sheet', () => {
    render(<BottomTabBar user={baseUser} />);

    expect(screen.getByRole('link', { name: 'groups' })).toHaveAttribute(
      'href',
      '/groups'
    );
    expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute(
      'href',
      '/settings'
    );
    expect(screen.getByRole('button', { name: 'signOut' })).toBeInTheDocument();
  });

  it('reports a sign-out failure via toast and re-enables the button', async () => {
    const user = userEvent.setup();
    const signOutMock = vi
      .fn()
      .mockResolvedValue({ error: new Error('sign-out failed') });
    createClientMock.mockReturnValue({ auth: { signOut: signOutMock } });

    render(<BottomTabBar user={baseUser} />);

    const signOutButton = screen.getByRole('button', { name: 'signOut' });
    await user.click(signOutButton);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('signOutError');
      expect(signOutButton).not.toBeDisabled();
    });
  });
});
