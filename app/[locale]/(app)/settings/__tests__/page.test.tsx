import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let profile: unknown = null;

vi.mock('@/lib/domain/onboarding/actions', () => ({
  getOnboardingProfile: vi.fn(async () => profile),
}));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1', email: 'a@b.c' } } }),
    },
  })),
}));
vi.mock('@/components/settings/appearance/appearance-row', () => ({
  AppearanceRow: () => <div data-testid="appearance-row" />,
}));
vi.mock('@/components/settings/profile/settings-form', () => ({
  SettingsForm: () => <div data-testid="settings-form" />,
}));
vi.mock('@/components/settings/identity/identity-rows', () => ({
  IdentityRows: () => <div />,
}));
vi.mock('@/components/settings/chrome/anchor-nav', () => ({
  SettingsAnchorNav: () => <nav />,
}));
vi.mock('@/components/billing/subscription/subscription-settings', () => ({
  SubscriptionSettings: () => <div />,
}));
vi.mock('@/components/settings/feedback/feedback-panel', () => ({
  FeedbackPanel: () => <div />,
}));
vi.mock('@/components/settings/account/account-panel', () => ({
  AccountPanel: () => <div />,
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

const { default: SettingsPage } = await import('../page');

async function renderPage() {
  render(await SettingsPage({ params: Promise.resolve({ locale: 'en' }) }));
}

describe('SettingsPage', () => {
  beforeEach(() => {
    profile = null;
  });

  // The theme applies to every signed-in page, so the switch for it cannot
  // wait for onboarding to create the profile the rest of Settings edits.
  it('offers Appearance before the profile exists', async () => {
    await renderPage();

    expect(screen.queryByTestId('settings-form')).toBeNull();
    expect(screen.getByTestId('appearance-row')).toBeInTheDocument();
  });

  it('leaves Appearance to the profile form once the profile exists', async () => {
    profile = { autoShareToCircle: false };
    await renderPage();

    expect(screen.getByTestId('settings-form')).toBeInTheDocument();
    expect(screen.queryByTestId('appearance-row')).toBeNull();
  });
});
