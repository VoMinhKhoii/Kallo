import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';

const mocks = vi.hoisted(() => ({
  locked: vi.fn<(feature: FeatureKey) => boolean>(),
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: mocks.locked,
    requirePremium: vi.fn(),
    openPaywall: vi.fn(),
  }),
}));

import { useLoggingMode } from '../use-logging-mode';

describe('useLoggingMode — the default mode follows the plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a Premium user (or anyone while unenforced) on Instant', () => {
    mocks.locked.mockReturnValue(false);
    const { result } = renderHook(() => useLoggingMode());

    expect(result.current[0]).toBe('normal');
  });

  it('starts a free user on Manual when AI analysis is locked', () => {
    mocks.locked.mockImplementation((f) => f === 'ai_analysis');
    const { result } = renderHook(() => useLoggingMode());

    expect(result.current[0]).toBe('manual');
    expect(mocks.locked).toHaveBeenCalledWith('ai_analysis');
  });

  it('moves to Manual when the entitlements land after first render', () => {
    // `locked` is false while the query is in flight, so the first render is
    // Instant; the default must follow the answer rather than freeze on it.
    mocks.locked.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useLoggingMode());
    expect(result.current[0]).toBe('normal');

    mocks.locked.mockImplementation((f) => f === 'ai_analysis');
    rerender();
    expect(result.current[0]).toBe('manual');
  });

  it('keeps an explicit pick over the default for the session', () => {
    mocks.locked.mockImplementation((f) => f === 'ai_analysis');
    const { result, rerender } = renderHook(() => useLoggingMode());

    act(() => result.current[1]('cheat'));
    rerender();
    expect(result.current[0]).toBe('cheat');

    // Even if entitlements change underneath, the pick stands.
    mocks.locked.mockReturnValue(false);
    rerender();
    expect(result.current[0]).toBe('cheat');
  });
});
