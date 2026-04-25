import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireAuthAndProfile } = vi.hoisted(() => ({
  mockRequireAuthAndProfile: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: mockRequireAuthAndProfile,
}));

import { requireAuthAndProfile } from '@/lib/auth';
import { getFoodSourceCandidates } from './candidates';

describe('getFoodSourceCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthAndProfile.mockResolvedValue({
      user: { id: 'user-1' },
      profile: {},
    });
  });

  it('rejects unsupported nutrient keys', async () => {
    await expect(
      getFoodSourceCandidates({ nutrient: 'vitaminHMcg' })
    ).rejects.toThrow();
  });

  it('authenticates before returning curated candidates', async () => {
    const result = await getFoodSourceCandidates({ nutrient: 'calciumMg' });

    expect(requireAuthAndProfile).toHaveBeenCalledTimes(1);
    expect(result.nutrient).toBe('calciumMg');
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates[0]).toMatchObject({
      nutrient: 'calciumMg',
      id: 'tofu',
    });
  });
});
