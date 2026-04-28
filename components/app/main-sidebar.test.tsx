import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainSidebar } from './main-sidebar';

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      navigationLabel: 'Main navigation',
      sectionLabel: 'Main',
      dashboard: 'Dashboard',
      logging: 'Log',
      nutrition: 'Nutrition',
      settings: 'Settings',
      expandSidebar: 'Expand sidebar',
      collapseSidebar: 'Collapse sidebar',
      completeProfile: 'Complete profile',
      resumeTitle: 'Resume profile',
      resumeDescription: 'Finish your profile.',
      signOut: 'Sign out',
    };

    return (key: string) => labels[key] ?? key;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

describe('MainSidebar', () => {
  it('links to nutrition instead of tracking', () => {
    render(<MainSidebar />);

    expect(screen.getByRole('link', { name: 'Nutrition' })).toHaveAttribute(
      'href',
      '/nutrition'
    );
    expect(
      screen.queryByRole('link', { name: 'Tracking' })
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('a[href="/tracking"]')
    ).not.toBeInTheDocument();
  });
});
