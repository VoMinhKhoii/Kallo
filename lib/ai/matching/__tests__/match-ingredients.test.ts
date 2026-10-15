import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';

const { cardsMock, legacyMock } = vi.hoisted(() => ({
  cardsMock: vi.fn(),
  legacyMock: vi.fn(async () => [
    { ingredientIndex: 0, candidates: ['legacy'] },
  ]),
}));
vi.mock('@/lib/ai/matching/cards/retrieval', () => ({
  MATCH_EXPIRED: 'expired',
  matchCardCandidates: cardsMock,
}));
vi.mock('@/lib/ai/matching/retrieve/top-k-cascade', () => ({
  matchTopKPerIngredient: legacyMock,
}));
vi.mock('@/lib/ai/matching/speculative', () => ({
  createV2SpeculativeMatcher: vi.fn(),
}));
vi.mock('@/lib/ai/matching/cards/search-index/search-index', () => ({
  cardIndexStatus: vi.fn(() => 'disabled'),
}));

const { matchIngredients } = await import('../match-ingredients');

const ings = [
  { rawName: 'Cơm', canonicalName: 'Cơm' },
  { rawName: 'Cá', canonicalName: 'Cá' },
] as DecomposedIngredientV2[];
const run = (opts?: { deadlineAt?: number }) =>
  matchIngredients(
    ings,
    [null, null],
    {} as AppDb,
    {} as GeminiClient,
    { k: 8, concurrency: 4 },
    opts
  );

beforeEach(() => vi.clearAllMocks());

describe('matchIngredients', () => {
  it('leaves ingredients unmatched when card matching expired, never starting legacy', async () => {
    cardsMock.mockResolvedValue('expired');
    expect(await run({ deadlineAt: Date.now() + 5_000 })).toEqual([
      { ingredientIndex: 0, candidates: [] },
      { ingredientIndex: 1, candidates: [] },
    ]);
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it('does not start legacy once the deadline has passed', async () => {
    cardsMock.mockResolvedValue(null);
    expect(await run({ deadlineAt: Date.now() - 1 })).toHaveLength(2);
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it('runs legacy when card retrieval is not ready and time is left', async () => {
    cardsMock.mockResolvedValue(null);
    expect(await run({ deadlineAt: Date.now() + 5_000 })).toEqual([
      { ingredientIndex: 0, candidates: ['legacy'] },
    ]);
    expect(cardsMock.mock.calls[0][3]).toEqual({
      deadlineAt: expect.any(Number),
    });
  });

  it('runs legacy without a deadline, as before', async () => {
    cardsMock.mockResolvedValue(null);
    await run();
    expect(legacyMock).toHaveBeenCalled();
  });
});
