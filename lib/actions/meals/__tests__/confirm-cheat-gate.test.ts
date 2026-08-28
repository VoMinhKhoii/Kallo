import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `assertCheatConfirmAllowed` — the premium gate on the CONFIRM half of the
 * cheat flow.
 *
 * Confirm is one action for two entry modes and the caller only names the
 * pending row by id, so the gate has to resolve the mode itself before it can
 * decide. That resolution is a query, which makes the ordering load-bearing:
 * with the kill-switch off it must not run AT ALL, or an unenforced build pays
 * a round-trip per confirm that today's build does not.
 */

const { mockDbSelect, mockGetBillingConfig, assertFeatureAccess } = vi.hoisted(
  () => {
    const enforcement = { enabled: false };
    return {
      mockDbSelect: vi.fn(),
      mockGetBillingConfig: Object.assign(
        vi.fn(() => ({ enforcementEnabled: enforcement.enabled })),
        { setEnforcement: (on: boolean) => (enforcement.enabled = on) }
      ),
      assertFeatureAccess: vi.fn(),
    };
  }
);

vi.mock('@/lib/domain/billing/billing', () => ({
  getBillingConfig: mockGetBillingConfig,
}));
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));
vi.mock('@/lib/infra/db/client', () => ({ db: { select: mockDbSelect } }));
vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./meal-doubles')).schema
);

import { assertCheatConfirmAllowed } from '@/lib/actions/meals/confirm-cheat';
import { FeatureLockedError } from '@/lib/core/errors/app-error';
import { MOCK_PROFILE, MOCK_USER, UUID_1 } from './meal-doubles';

function queuePending(rows: unknown[]) {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

const call = () =>
  assertCheatConfirmAllowed(MOCK_USER.id, MOCK_PROFILE.createdAt, UUID_1);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBillingConfig.setEnforcement(true);
  assertFeatureAccess.mockResolvedValue(undefined);
});

describe('assertCheatConfirmAllowed', () => {
  it('kill-switch off → returns without issuing a single query', async () => {
    mockGetBillingConfig.setEnforcement(false);

    await expect(call()).resolves.toBeUndefined();

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });

  it('gates a cheat pending row', async () => {
    queuePending([{ entryMode: 'cheat' }]);

    await call();

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      { userId: MOCK_USER.id, profileCreatedAt: MOCK_PROFILE.createdAt },
      'cheat_meal'
    );
  });

  it('propagates the 402 when the cheat feature is locked', async () => {
    queuePending([{ entryMode: 'cheat' }]);
    assertFeatureAccess.mockRejectedValueOnce(
      new FeatureLockedError('cheat_meal', 'not_entitled', 'locked')
    );

    await expect(call()).rejects.toBeInstanceOf(FeatureLockedError);
  });

  it('leaves a precise pending row alone', async () => {
    queuePending([{ entryMode: 'precise' }]);

    await expect(call()).resolves.toBeUndefined();
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });

  it('stays silent when the pending row is missing or foreign', async () => {
    // The confirm action deletes-and-checks the same row moments later and
    // raises its own not-found; a second error here would only change which
    // message a stale card gets.
    queuePending([]);

    await expect(call()).resolves.toBeUndefined();
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });
});
