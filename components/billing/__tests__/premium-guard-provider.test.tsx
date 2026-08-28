import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';

const mocks = vi.hoisted(() => ({
  useEntitlements: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/hooks/billing/use-entitlements', () => ({
  useEntitlements: mocks.useEntitlements,
}));

vi.mock('sonner', () => ({
  toast: { info: mocks.toastInfo, error: vi.fn(), success: vi.fn() },
}));

// The real dialog drags in the RevenueCat web SDK; this test only cares that
// the provider mounts it (and with which `open`) at all.
vi.mock('@/components/billing/paywall/paywall-dialog', () => ({
  PaywallDialog: ({ open }: { open: boolean }) => (
    <div data-testid="paywall" data-open={open ? 'true' : 'false'} />
  ),
}));

import {
  PremiumGuardProvider,
  usePremiumGuard,
} from '../premium-guard-provider';

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
    features: {
      ai_analysis: { allowed: false, reason: 'not_entitled' },
      label_scan: { allowed: false, reason: 'not_entitled' },
      micronutrients: { allowed: false, reason: 'not_entitled' },
      relog: { allowed: false, reason: 'not_entitled' },
      cheat_meal: { allowed: false, reason: 'not_entitled' },
      copy_split: { allowed: false, reason: 'not_entitled' },
      unlimited_circle: { allowed: false, reason: 'not_entitled' },
    },
    ...overrides,
  };
}

function Consumer() {
  const { locked, requirePremium, openPaywall } = usePremiumGuard();
  return (
    <div>
      <span data-testid="locked">{String(locked('ai_analysis'))}</span>
      <button
        type="button"
        data-testid="require"
        onClick={(event) => {
          event.currentTarget.dataset.result = String(
            requirePremium('ai_analysis')
          );
        }}
      >
        require
      </button>
      <button type="button" data-testid="open" onClick={openPaywall}>
        open
      </button>
    </div>
  );
}

function renderProvider(enforcementEnabled: boolean) {
  return render(
    <PremiumGuardProvider
      userId="user-1"
      email="a@b.com"
      enforcementEnabled={enforcementEnabled}
    >
      <Consumer />
    </PremiumGuardProvider>
  );
}

describe('PremiumGuardProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useEntitlements.mockReturnValue({ data: entitlements() });
  });

  describe('with enforcement off', () => {
    it('never queries entitlements and never mounts the paywall', async () => {
      const user = userEvent.setup();
      renderProvider(false);

      // Disabling the query at the hook boundary keeps the request off the
      // wire for every user in the kill-switched-off world.
      expect(mocks.useEntitlements).toHaveBeenCalledWith(null);
      expect(screen.getByTestId('locked')).toHaveTextContent('false');

      await user.click(screen.getByTestId('require'));
      expect(screen.getByTestId('require').dataset.result).toBe('true');

      await user.click(screen.getByTestId('open'));
      expect(screen.queryByTestId('paywall')).toBeNull();
      expect(mocks.toastInfo).not.toHaveBeenCalled();
    });
  });

  describe('with enforcement on', () => {
    it('queries entitlements and opens the paywall for a locked feature', async () => {
      const user = userEvent.setup();
      renderProvider(true);

      expect(mocks.useEntitlements).toHaveBeenCalledWith('user-1');
      expect(screen.getByTestId('locked')).toHaveTextContent('true');

      const paywall = await screen.findByTestId('paywall');
      expect(paywall).toHaveAttribute('data-open', 'false');

      await user.click(screen.getByTestId('require'));
      expect(screen.getByTestId('require').dataset.result).toBe('false');
      await waitFor(() =>
        expect(screen.getByTestId('paywall')).toHaveAttribute(
          'data-open',
          'true'
        )
      );
    });

    it('toasts instead of opening a paywall that would render nothing', async () => {
      mocks.useEntitlements.mockReturnValue({
        data: entitlements({ purchasesEnabled: false }),
      });
      const user = userEvent.setup();
      renderProvider(true);

      await screen.findByTestId('paywall');
      await user.click(screen.getByTestId('require'));

      // The action still has to be refused — only the dead-end dialog is
      // swapped for an explanation.
      expect(screen.getByTestId('require').dataset.result).toBe('false');
      // The global next-intl stub echoes the key, namespace stripped.
      expect(mocks.toastInfo).toHaveBeenCalledWith('purchasesUnavailable');
      expect(screen.getByTestId('paywall')).toHaveAttribute(
        'data-open',
        'false'
      );
    });
  });
});
