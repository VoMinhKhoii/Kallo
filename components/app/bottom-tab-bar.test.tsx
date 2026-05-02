import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomTabBar } from './bottom-tab-bar';

const { createClientMock, scrollDirectionMock, toastErrorMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    scrollDirectionMock: vi.fn(),
    toastErrorMock: vi.fn(),
  })
);

vi.mock('@/hooks/use-scroll-direction', () => ({
  useScrollDirection: scrollDirectionMock,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

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

describe('BottomTabBar', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    scrollDirectionMock.mockReset();
    scrollDirectionMock.mockReturnValue('up');
    toastErrorMock.mockReset();
  });

  it('keeps the bottom navigation visible while keyboard focus is inside', () => {
    scrollDirectionMock.mockReturnValue('down');

    render(
      <BottomTabBar user={{ email: 'minh@example.com', displayName: 'Minh' }} />
    );

    const nav = screen.getByRole('navigation', { name: 'label' });
    expect(nav).toHaveAttribute('data-hidden', 'true');

    fireEvent.focus(screen.getByRole('link', { name: 'dashboard' }));

    expect(nav).toHaveAttribute('data-hidden', 'false');
  });

  it('shows an error and re-enables sign-out when Supabase sign-out fails', async () => {
    const user = userEvent.setup();
    const signOutMock = vi
      .fn()
      .mockResolvedValue({ error: new Error('sign-out failed') });
    createClientMock.mockReturnValue({ auth: { signOut: signOutMock } });

    render(
      <BottomTabBar user={{ email: 'minh@example.com', displayName: 'Minh' }} />
    );

    const signOutButton = screen.getByRole('button', { name: 'signOut' });
    await user.click(signOutButton);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('signOutError');
      expect(signOutButton).not.toBeDisabled();
    });
  });
});
