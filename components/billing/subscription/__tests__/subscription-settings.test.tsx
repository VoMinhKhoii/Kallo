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
    trial: { active: true, endsAt: null, daysRemaining: 5 },
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
});
