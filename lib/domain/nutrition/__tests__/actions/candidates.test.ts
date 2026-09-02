import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireAuthAndProfile,
  mockLimit,
  mockAssertFeatureAccess,
  mockAssertRateLimit,
} = vi.hoisted(() => ({
  mockRequireAuthAndProfile: vi.fn(),
  mockLimit: vi.fn(),
  mockAssertFeatureAccess: vi.fn(),
  mockAssertRateLimit: vi.fn(),
}));

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: mockAssertRateLimit,
}));

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('@/lib/domain/billing/feature-gate', () => ({
  assertFeatureAccess: mockAssertFeatureAccess,
}));

vi.mock('@/lib/infra/db/client', () => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: mockLimit,
  };
  return { db: chain };
});

import { FeatureLockedError } from '@/lib/core/errors/app-error';
import { getFoodSourceCandidates } from '@/lib/domain/nutrition/actions/candidates';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

describe('getFoodSourceCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    mockAssertFeatureAccess.mockResolvedValue(undefined);
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it('throttles per user before running the unindexed scan', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    mockAssertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 2));

    // The query below is a sequential scan of the whole composition table on a
    // two-connection pool, and the web reaches this as a Server Action — so the
    // guard lives here, not at the route, and it fires before the scan.
    await expect(
      getFoodSourceCandidates({ nutrient: 'calciumMg' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(mockAssertRateLimit).toHaveBeenCalledWith('nutritionCandidates', {
      kind: 'user',
      value: 'user-1',
    });
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('refuses a viewer without the micronutrients feature, before any query', async () => {
    mockAssertFeatureAccess.mockRejectedValueOnce(
      new FeatureLockedError('micronutrients', 'not_entitled', 'locked')
    );

    await expect(
      getFoodSourceCandidates({ nutrient: 'calciumMg' })
    ).rejects.toBeInstanceOf(FeatureLockedError);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it('rejects non-card nutrient keys (e.g. hidden vitamin H)', async () => {
    await expect(
      getFoodSourceCandidates({ nutrient: 'vitaminHMcg' })
    ).rejects.toThrow();
  });

  it('returns deduped DB-derived foods with the nutrient unit', async () => {
    mockLimit.mockResolvedValue([
      { id: '1', name: 'Đậu phụ', nameEn: 'Tofu', amount: '350' },
      // Same food (raw/cooked variant) — deduped by English name.
      { id: '2', name: 'Đậu phụ luộc', nameEn: 'tofu', amount: '300' },
      { id: '3', name: 'Cải bẹ xanh', nameEn: 'Mustard greens', amount: '200' },
    ]);

    const result = await getFoodSourceCandidates({ nutrient: 'calciumMg' });

    expect(requireAuthAndProfile).toHaveBeenCalledTimes(1);
    expect(mockAssertFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      'micronutrients'
    );
    expect(result.nutrient).toBe('calciumMg');
    expect(result.foods).toHaveLength(2);
    expect(result.foods[0]).toMatchObject({
      id: '1',
      name: 'Đậu phụ',
      nameEn: 'Tofu',
      amount: 350,
      unit: 'mg',
    });
    expect(result.foods[1]).toMatchObject({ nameEn: 'Mustard greens' });
  });
});
