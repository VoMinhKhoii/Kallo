import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAuthAndProfile, mockLimit } = vi.hoisted(() => ({
  mockRequireAuthAndProfile: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

vi.mock('@/lib/db', () => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: mockLimit,
  };
  return { db: chain };
});

import { requireAuthAndProfile } from '@/lib/auth/session';
import { getFoodSourceCandidates } from '@/lib/nutrition/actions/candidates';

describe('getFoodSourceCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: {},
    });
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
