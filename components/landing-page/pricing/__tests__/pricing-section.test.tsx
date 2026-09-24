import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';
import type { Package } from '@/lib/domain/billing/web-purchases';

const mocks = vi.hoisted(() => ({
  openDialog: vi.fn(),
  useEntitlements: vi.fn(),
  useWebPrices: vi.fn(),
  offerings: vi.fn(),
  select: vi.fn(),
  confirmActivation: vi.fn(),
  purchase: vi.fn(),
  push: vi.fn(),
}));

vi.mock('motion/react', () => {
  const plain =
    (Tag: 'div' | 'h2' | 'p') =>
    ({ children, ...props }: React.PropsWithChildren<object>) => (
      <Tag {...props}>{children}</Tag>
    );
  return {
    useReducedMotion: () => true,
    motion: { div: plain('div'), h2: plain('h2'), p: plain('p') },
  };
});
vi.mock('@/components/auth/auth-provider', () => ({
  useAuthDialog: () => ({ openDialog: mocks.openDialog }),
}));
vi.mock('@/hooks/billing/use-entitlements', () => ({
  useEntitlements: mocks.useEntitlements,
}));
vi.mock('@/hooks/billing/use-web-prices', () => ({
  useWebPrices: mocks.useWebPrices,
}));
vi.mock('@/hooks/billing/use-paywall-offerings', () => ({
  usePaywallOfferings: mocks.offerings,
}));
vi.mock('@/hooks/billing/use-paywall-purchase', () => ({
  usePaywallPurchase: mocks.purchase,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/lib/infra/telemetry/analytics/track', () => ({ track: vi.fn() }));

import { ApplyPricingRequest } from '../checkout/apply-pricing-request';
import { PricingBackLink } from '../checkout/back-link';
import { PricingCheckoutProvider } from '../checkout/pricing-checkout-provider';
import { PricingSection } from '../pricing-section';

// The offering a VN buyer's checkout would use — prices in đồng, paid week.
const WEEK = {
  price: { amountMicros: 7_999e6, currency: 'VND' },
  period: { number: 1, unit: 'week' },
};
const ANNUAL = {
  identifier: '$rc_annual',
  webBillingProduct: {
    identifier: 'pri_01kz49s9jm5m5xhzwktnz4005q',
    price: { amountMicros: 449_000e6, currency: 'VND' },
    introPricePhase: WEEK,
  },
} as unknown as Package;
const MONTHLY = {
  identifier: '$rc_monthly',
  webBillingProduct: {
    identifier: 'pri_01kz49s9hjsmk53evgrsh55ccr',
    price: { amountMicros: 49_000e6, currency: 'VND' },
    introPricePhase: WEEK,
  },
} as unknown as Package;

const LIVE_USD = {
  monthly: { amount: 7.99, currency: 'USD' },
  yearly: { amount: 29.99, currency: 'USD' },
  intro: { price: { amount: 0.89, currency: 'USD' }, days: 7 },
};

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
    trial: { active: false, endsAt: null, daysRemaining: 0 },
    enforcementEnabled: true,
    features: {} as EntitlementsResponse['features'],
    ...overrides,
  };
}

function purchaseState(overrides: Record<string, unknown> = {}) {
  return {
    pendingId: null,
    purchasing: false,
    succeeded: false,
    activationPending: false,
    checkingActivation: false,
    select: mocks.select,
    confirmActivation: mocks.confirmActivation,
    reset: vi.fn(),
    ...overrides,
  };
}

function renderPricing(request?: {
  userId: string | null;
  from: string | null;
}) {
  return render(
    <PricingCheckoutProvider>
      <PricingBackLink />
      <PricingSection />
      {request && <ApplyPricingRequest {...request} />}
    </PricingCheckoutProvider>
  );
}

const freeCta = () => screen.getByTestId('pricing-free-cta');
const premiumCta = () => screen.getByTestId('pricing-premium-cta');

describe('PricingSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWebPrices.mockReturnValue({ data: undefined });
    mocks.useEntitlements.mockReturnValue({ data: undefined, isError: false });
    mocks.offerings.mockReturnValue({
      packages: [ANNUAL, MONTHLY],
      isPending: false,
      isError: false,
    });
    mocks.purchase.mockReturnValue(purchaseState());
  });

  describe('signed out', () => {
    it('opens sign-up from both plans, with the first-week price on Premium', async () => {
      const user = userEvent.setup();
      renderPricing();

      // The global next-intl stub echoes keys, filling in parameters.
      expect(premiumCta()).toHaveTextContent('plans.premium.cta');
      expect(screen.getByTestId('pricing-premium-price')).toHaveTextContent(
        'plans.premium.priceYearly'
      );
      expect(screen.getByTestId('pricing-premium-fineprint')).toHaveTextContent(
        'plans.premium.fineprintYearly'
      );

      await user.click(premiumCta());
      await user.click(freeCta());
      expect(mocks.openDialog).toHaveBeenCalledTimes(2);
      expect(mocks.openDialog).toHaveBeenCalledWith('sign-up');
      expect(mocks.useEntitlements).toHaveBeenLastCalledWith(null);
      expect(screen.queryByTestId('pricing-back-link')).toBeNull();
    });

    it('hangs the saving off the button on Yearly only', async () => {
      mocks.useWebPrices.mockReturnValue({ data: LIVE_USD });
      const user = userEvent.setup();
      renderPricing();

      // Live prices compute the saving; the stub echoes the chip's key.
      expect(screen.getByText('discount')).toBeInTheDocument();

      await user.click(screen.getByTestId('pricing-period-monthly'));
      expect(screen.getByTestId('pricing-period-monthly')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.queryByText('discount')).toBeNull();
      expect(screen.getByTestId('pricing-premium-price')).toHaveTextContent(
        '$7.99'
      );
      expect(screen.getByTestId('pricing-premium-fineprint')).toHaveTextContent(
        'plans.premium.fineprintMonthly'
      );
    });

    it('prints live Paddle prices when they have loaded', () => {
      mocks.useWebPrices.mockReturnValue({ data: LIVE_USD });
      renderPricing();
      expect(screen.getByTestId('pricing-premium-price')).toHaveTextContent(
        '$2.50'
      );
    });
  });

  describe('signed in, Free', () => {
    beforeEach(() => {
      mocks.useEntitlements.mockReturnValue({
        data: entitlements(),
        isError: false,
      });
    });

    it("prices the cards from the offering, never booting Paddle's preview", () => {
      // RevenueCat runs its own Paddle.js for this visitor's checkout; a second
      // one for the preview would share its global.
      mocks.useWebPrices.mockReturnValue({ data: LIVE_USD });
      renderPricing({ userId: 'user-1', from: null });
      expect(mocks.useWebPrices).toHaveBeenLastCalledWith(false);
      // 449.000 ₫ a year, per month — the offering's đồng, in the page locale.
      expect(screen.getByTestId('pricing-premium-price')).toHaveTextContent(
        '₫37,417'
      );
    });

    it('marks Free as the current plan and checks out the selected period', async () => {
      const user = userEvent.setup();
      renderPricing({ userId: 'user-1', from: '/en/settings' });

      await waitFor(() => expect(freeCta()).toHaveTextContent('currentPlan'));
      expect(freeCta()).toBeDisabled();
      expect(mocks.useEntitlements).toHaveBeenLastCalledWith('user-1');

      await user.click(premiumCta());
      expect(mocks.select).toHaveBeenCalledWith(ANNUAL);

      await user.click(screen.getByTestId('pricing-period-monthly'));
      await user.click(premiumCta());
      expect(mocks.select).toHaveBeenLastCalledWith(MONTHLY);
      expect(mocks.openDialog).not.toHaveBeenCalled();

      expect(screen.getByTestId('pricing-back-link')).toHaveAttribute(
        'href',
        '/en/settings'
      );
    });

    it('disables the gold button and says why while purchases are off', async () => {
      mocks.useEntitlements.mockReturnValue({
        data: entitlements({ purchasesEnabled: false }),
        isError: false,
      });
      renderPricing({ userId: 'user-1', from: null });

      await waitFor(() => expect(premiumCta()).toBeDisabled());
      expect(screen.getByText('premium.purchasesUnavailable')).toBeVisible();
      // No offering is read while the store is closed.
      expect(mocks.offerings).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false })
      );
    });

    it('swaps the cards for the activation status once a purchase lands', async () => {
      mocks.purchase.mockReturnValue(purchaseState({ succeeded: true }));
      const user = userEvent.setup();
      renderPricing({ userId: 'user-1', from: '/en/nutrition' });

      await waitFor(() =>
        expect(screen.queryByTestId('pricing-premium-cta')).toBeNull()
      );
      await user.click(screen.getByRole('button', { name: 'successCta' }));
      expect(mocks.push).toHaveBeenCalledWith('/en/nutrition');
    });
  });

  it('shows a subscriber Premium as the current plan', async () => {
    mocks.useEntitlements.mockReturnValue({
      data: entitlements({ tier: 'premium' }),
      isError: false,
    });
    renderPricing({ userId: 'user-1', from: null });

    await waitFor(() => expect(premiumCta()).toHaveTextContent('currentPlan'));
    expect(premiumCta()).toBeDisabled();
    expect(screen.queryByText('discount')).toBeNull();
    expect(freeCta()).toBeDisabled();
  });
});
