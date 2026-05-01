import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainSidebar } from './main-sidebar';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

describe('MainSidebar (back-compat re-export of DesktopSidebar)', () => {
  it('renders the nutrition link, not tracking', () => {
    render(
      <MainSidebar user={{ email: 'tester@example.com', displayName: null }} />
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
});
