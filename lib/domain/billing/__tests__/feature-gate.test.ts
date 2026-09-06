import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureLockedError } from '@/lib/core/errors/app-error';

const { mockCheckFeatureAccess, mockGetBillingConfig, setEnforcement } =
  vi.hoisted(() => {
    const enforcement = { enabled: false };
    return {
      mockCheckFeatureAccess: vi.fn(),
      mockGetBillingConfig: vi.fn(() => ({
        enforcementEnabled: enforcement.enabled,
      })),
      setEnforcement: (enabled: boolean) => {
        enforcement.enabled = enabled;
      },
    };
  });

vi.mock('@/lib/domain/billing/billing', () => ({
  checkFeatureAccess: mockCheckFeatureAccess,
  getBillingConfig: mockGetBillingConfig,
}));

const { assertFeatureAccess, checkFeatureGate } = await import(
  '@/lib/domain/billing/feature-gate'
);

const input = {
  userId: '11111111-1111-1111-1111-111111111111',
  profileCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockCheckFeatureAccess.mockReset();
  setEnforcement(false);
});

describe('checkFeatureGate', () => {
  it('kill-switch off → unlocked without reading entitlements', async () => {
    await expect(checkFeatureGate(input, 'relog')).resolves.toEqual({
      locked: false,
    });
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });

  it('enforcement on + allowed → unlocked', async () => {
    setEnforcement(true);
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    await expect(checkFeatureGate(input, 'micronutrients')).resolves.toEqual({
      locked: false,
    });
    expect(mockCheckFeatureAccess).toHaveBeenCalledWith(
      input,
      'micronutrients'
    );
  });

  it('enforcement on + trial_expired → locked with that reason', async () => {
    setEnforcement(true);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'trial_expired',
    });

    await expect(checkFeatureGate(input, 'cheat_meal')).resolves.toEqual({
      locked: true,
      reason: 'trial_expired',
    });
  });

  it('enforcement on + not_entitled → locked with that reason', async () => {
    setEnforcement(true);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    await expect(checkFeatureGate(input, 'copy_split')).resolves.toEqual({
      locked: true,
      reason: 'not_entitled',
    });
  });
});

describe('assertFeatureAccess', () => {
  it('resolves silently when the kill-switch is off', async () => {
    await expect(
      assertFeatureAccess(input, 'unlimited_circle')
    ).resolves.toBeUndefined();
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });

  it('resolves silently when the feature is allowed', async () => {
    setEnforcement(true);
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    await expect(
      assertFeatureAccess(input, 'label_scan')
    ).resolves.toBeUndefined();
  });

  it('throws a 402 FeatureLockedError echoing the feature and reason', async () => {
    setEnforcement(true);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    const error = await assertFeatureAccess(input, 'label_scan').catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(FeatureLockedError);
    const locked = error as FeatureLockedError;
    expect(locked.status).toBe(402);
    expect(locked.code).toBe('feature_locked');
    expect(locked.feature).toBe('label_scan');
    expect(locked.reason).toBe('not_entitled');
    expect(locked.toJSON().error.feature).toBe('label_scan');
  });
});
