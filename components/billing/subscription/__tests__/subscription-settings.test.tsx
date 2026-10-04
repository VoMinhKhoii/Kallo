import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';

const mocks = vi.hoisted(() => ({ useEntitlements: vi.fn() }));

vi.mock('@/hooks/billing/use-entitlements', () => ({
  useEntitlements: mocks.useEntitlements,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/settings' }));

import { SubscriptionSettings } from '../subscription-settings';

function entitlements(
  overrides: Partial<EntitlementsResponse> = {}
): EntitlementsResponse {
  return {
    userId: 'user-1',
    purchasesEnabled: true,
    tier: 'free',
    reconciliationRequired: false,
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    store: null,
    managementUrl: null,
    managementStore: null,
    hasActiveSubscription: false,
    enforcementEnabled: true,
    features: {} as EntitlementsResponse['features'],
    ...overrides,
  };
}

describe('SubscriptionSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links a Free user straight to /pricing, with no trial copy', () => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements(),
      isPending: false,
      isError: false,
    });
    render(<SubscriptionSettings userId="user-1" locale="en" />);

    expect(screen.getByText('freePlan')).toBeInTheDocument();
    expect(screen.queryByText(/trial/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'upgradeCta' })).toHaveAttribute(
      'href',
      `/pricing?from=${encodeURIComponent('/en/settings')}`
    );
  });

  it('puts Manage subscription beside a subscriber plan', () => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements({
        tier: 'premium',
        hasActiveSubscription: true,
        willRenew: true,
        expiresAt: '2026-10-01T00:00:00Z',
        managementUrl: 'https://customer-portal.paddle.com/cpl_1',
      }),
      isPending: false,
      isError: false,
    });
    render(<SubscriptionSettings userId="user-1" locale="en" />);

    expect(screen.getByText('premiumPlan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'manageWeb' })).toHaveAttribute(
      'href',
      'https://customer-portal.paddle.com/cpl_1'
    );
  });

  // Premium the user never paid for (welcome or an admin grant) has no
  // subscription to renew, so its last-days reminder must not say "renew".
  // The copy follows the grant that owns the displayed end date, so a promo
  // beside a cancelled, sooner-ending subscription is still free Premium.
  it.each([
    {
      source: 'promo',
      hasActiveSubscription: false,
      title: 'promoExpiryTitle',
    },
    { source: 'promo', hasActiveSubscription: true, title: 'promoExpiryTitle' },
    { source: 'revenuecat', hasActiveSubscription: true, title: 'expiryTitle' },
  ])('ending-soon copy for $source (subscription: $hasActiveSubscription)', ({
    source,
    hasActiveSubscription,
    title,
  }) => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements({
        tier: 'premium',
        source,
        hasActiveSubscription,
        willRenew: false,
        expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      }),
      isPending: false,
      isError: false,
    });
    render(<SubscriptionSettings userId="user-1" locale="en" />);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('offers Upgrade beside complimentary Premium while purchases are open', () => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements({
        tier: 'premium',
        source: 'promo',
        complimentary: true,
        expiresAt: '2026-10-18T00:00:00Z',
      }),
      isPending: false,
      isError: false,
    });
    render(<SubscriptionSettings userId="user-1" locale="en" />);

    expect(screen.getByText('premiumPlan')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'upgradeCta' })
    ).toBeInTheDocument();
  });

  it('offers no Upgrade beside paid Premium', () => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements({
        tier: 'premium',
        source: 'revenuecat',
        complimentary: false,
        hasActiveSubscription: true,
        willRenew: true,
        expiresAt: '2026-10-18T00:00:00Z',
      }),
      isPending: false,
      isError: false,
    });
    render(<SubscriptionSettings userId="user-1" locale="en" />);

    expect(screen.queryByRole('link', { name: 'upgradeCta' })).toBeNull();
  });
});
