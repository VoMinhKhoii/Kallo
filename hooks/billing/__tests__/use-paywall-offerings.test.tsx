import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES } from '@/lib/domain/billing/entitlement/features';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';
import type { Package } from '@/lib/domain/billing/web-purchases';

const { fetchEntitlements, reconcileEntitlements } = vi.hoisted(() => ({
  fetchEntitlements: vi.fn(),
  reconcileEntitlements: vi.fn(),
}));
const { hasActivationPending } = vi.hoisted(() => ({
  hasActivationPending: vi.fn<(userId: string) => boolean>(),
}));
const { getOfferings } = vi.hoisted(() => ({ getOfferings: vi.fn() }));

vi.mock('@/lib/domain/billing/entitlements-client', () => ({
  entitlementsKeys: {
    all: ['entitlements'],
    user: (userId: string) => ['entitlements', userId],
  },
  fetchEntitlements: (...args: unknown[]) => fetchEntitlements(...args),
  reconcileEntitlements: (...args: unknown[]) => reconcileEntitlements(...args),
}));
vi.mock('@/lib/domain/billing/activation/activation-pending', () => ({
  hasActivationPending: (userId: string) => hasActivationPending(userId),
}));
vi.mock('@/lib/domain/billing/web-purchases', () => ({
  getOfferings: (...args: unknown[]) => getOfferings(...args),
}));

const { usePaywallOfferings } = await import(
  '@/hooks/billing/use-paywall-offerings'
);

function snapshot(tier: 'free' | 'premium'): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: true,
    enforcementEnabled: false,
    tier,
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
    features: entitlementFeatures(tier === 'premium'),
  };
}

// Every gated feature answers the same way in these tests; derive them from
// the catalog so adding a feature never breaks this fixture.
function entitlementFeatures(
  allowed: boolean
): EntitlementsResponse['features'] {
  return Object.fromEntries(
    Object.keys(FEATURES).map((key) => [
      key,
      { allowed, reason: allowed ? 'entitled' : 'not_entitled' },
    ])
  ) as EntitlementsResponse['features'];
}

function pkg(identifier: string): Package {
  return {
    identifier: `pkg_${identifier}`,
    webBillingProduct: { identifier, price: { formattedPrice: '₫99.000' } },
  } as unknown as Package;
}

function offering(...identifiers: string[]) {
  return { availablePackages: identifiers.map(pkg) };
}

function harness(
  options: { enabled?: boolean; reconciliationRequired?: boolean } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    () =>
      usePaywallOfferings({
        userId: 'user-a',
        enabled: options.enabled ?? true,
        reconciliationRequired: options.reconciliationRequired ?? false,
      }),
    { wrapper }
  );
  return { ...rendered, queryClient };
}

describe('usePaywallOfferings', () => {
  beforeEach(() => {
    fetchEntitlements.mockReset().mockResolvedValue(snapshot('free'));
    reconcileEntitlements.mockReset().mockResolvedValue(snapshot('free'));
    hasActivationPending.mockReset().mockReturnValue(false);
    getOfferings
      .mockReset()
      .mockResolvedValue(offering('kallo_premium_annual'));
  });

  it('touches neither the server nor the provider while disabled', async () => {
    const { result } = harness({ enabled: false });

    await Promise.resolve();

    expect(fetchEntitlements).not.toHaveBeenCalled();
    expect(reconcileEntitlements).not.toHaveBeenCalled();
    expect(getOfferings).not.toHaveBeenCalled();
    expect(result.current.packages).toEqual([]);
  });

  it('spends only a cheap server read when nothing needs recovery', async () => {
    const { result } = harness();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(fetchEntitlements).toHaveBeenCalledWith('user-a');
    expect(reconcileEntitlements).not.toHaveBeenCalled();
    expect(result.current.packages).toHaveLength(1);
  });

  it('caches the fresh snapshot so the rest of the UI sees it', async () => {
    const { result, queryClient } = harness();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(queryClient.getQueryData(['entitlements', 'user-a'])).toEqual(
      snapshot('free')
    );
  });

  it('spends a provider reconcile when the server asked for one', async () => {
    const { result } = harness({ reconciliationRequired: true });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(reconcileEntitlements).toHaveBeenCalledWith('user-a');
    expect(fetchEntitlements).not.toHaveBeenCalled();
  });

  it('spends a provider reconcile when an earlier checkout is unaccounted for', async () => {
    hasActivationPending.mockReturnValue(true);

    const { result } = harness();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(reconcileEntitlements).toHaveBeenCalledWith('user-a');
    expect(fetchEntitlements).not.toHaveBeenCalled();
  });

  it('offers nothing to a user the fresh read says is already premium', async () => {
    fetchEntitlements.mockResolvedValue(snapshot('premium'));

    const { result } = harness();

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(getOfferings).not.toHaveBeenCalled();
    expect(result.current.packages).toEqual([]);
  });

  it('hides the deliberately deferred plan without shouting about it', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getOfferings.mockResolvedValue(
      offering('kallo_premium_annual', 'kallo_premium_lifetime')
    );

    const { result } = harness();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.packages).toHaveLength(1);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('shouts about an id the catalog cannot resolve at all', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getOfferings.mockResolvedValue(offering('pri_not_in_the_catalog'));

    const { result } = harness();
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.packages).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      '[billing] Ignoring unexpected web product: pri_not_in_the_catalog'
    );
    consoleError.mockRestore();
  });

  it('reports a failed load rather than an empty offering', async () => {
    getOfferings.mockRejectedValue(new Error('offline'));

    const { result } = harness();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.packages).toEqual([]);
  });
});
