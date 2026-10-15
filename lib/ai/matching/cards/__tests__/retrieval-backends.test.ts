import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';

vi.mock('server-only', () => ({}));
const attach = vi.fn(async (..._args: unknown[]) => {});
vi.mock('@/lib/ai/matching/candidate', () => ({
  attachCandidateNutrition: (...args: unknown[]) => attach(...args),
}));
const resolveCardBackend = vi.fn();
vi.mock('../search-index/search-index', () => ({
  resolveCardBackend: (...args: unknown[]) => resolveCardBackend(...args),
}));

const { buildCardCatalog } = await import('../catalog');
const { MATCH_EXPIRED, matchCardCandidates } = await import('../retrieval');

const catalog = buildCardCatalog([
  {
    id: 'usda_brisket',
    source_code: 'USDA_SR',
    state: 'raw',
    name_en: 'Beef, brisket, raw',
    name_primary: 'Ức bò',
    food: 'beef brisket, raw',
    aliases_en: ['brisket'],
    names_vi: ['ức bò'],
    part_cut: 'brisket',
    form_processing: null,
    cooking_method: null,
    fat_level: null,
    brand: null,
  },
]);
const ing: DecomposedIngredientV2 = {
  rawName: 'Ức bò',
  canonicalName: 'Beef brisket',
  queryEn: 'beef brisket raw',
  nameVi: 'ức bò',
  tableName: 'Beef, brisket, raw',
};
const gemini = {
  generateEmbeddingBatch: vi.fn(async (texts: string[]) =>
    texts.map(() => [0.1])
  ),
} as unknown as GeminiClient;
const execute = vi.fn();
const db = { execute } as unknown as AppDb;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('matchCardCandidates backends', () => {
  it('searches the artifact in the worker and fetches nutrition fresh', async () => {
    const search = vi.fn(async (embeddings: number[][]) =>
      embeddings.map(() => [{ id: 'usda_brisket', similarity: 0.93 }])
    );
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search,
    });

    const out = await matchCardCandidates([ing], db, gemini);

    expect(Array.isArray(out)).toBe(true);
    const [result] = out as Exclude<typeof out, null | typeof MATCH_EXPIRED>;
    expect(result.retrieval).toEqual({ vectorSource: 'index', build: 'b1' });
    expect(result.candidates[0].info.similarity).toBeCloseTo(0.93);
    expect(execute).not.toHaveBeenCalled(); // no SQL vector search
    expect(attach.mock.calls[0][2]).toEqual({ fresh: true });
  });

  it('falls back to the lexical arms when the worker search fails', async () => {
    const search = vi.fn(async () => {
      throw new Error('worker unavailable');
    });
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search,
    });

    const out = await matchCardCandidates([ing], db, gemini);

    const [result] = out as Exclude<typeof out, null | typeof MATCH_EXPIRED>;
    expect(result.retrieval?.vectorSource).toBe('none');
    expect(result.candidates.map((c) => c.info.foodCompositionId)).toEqual([
      'usda_brisket',
    ]);
    expect(result.candidates[0].info.matchType).toBe('fuzzy');
  });

  it('uses the SQL search and the cached nutrition on the database path', async () => {
    execute.mockResolvedValue([
      { query_index: 1, food_composition_id: 'usda_brisket', similarity: 0.9 },
    ]);
    resolveCardBackend.mockResolvedValue({ kind: 'db', catalog });

    const out = await matchCardCandidates([ing], db, gemini);

    const [result] = out as Exclude<typeof out, null | typeof MATCH_EXPIRED>;
    expect(result.retrieval).toEqual({ vectorSource: 'db' });
    expect(execute).toHaveBeenCalled();
    expect(attach.mock.calls[0][2]).toEqual({ fresh: false });
  });

  it('expires instead of starting work once the deadline has passed', async () => {
    resolveCardBackend.mockResolvedValue('expired');
    expect(
      await matchCardCandidates([ing], db, gemini, { deadlineAt: 1 })
    ).toBe(MATCH_EXPIRED);
    expect(gemini.generateEmbeddingBatch).not.toHaveBeenCalled();
  });

  it('expires when the nutrition fetch outlasts the deadline', async () => {
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search: async (e: number[][]) => e.map(() => []),
    });
    attach.mockImplementationOnce(() => new Promise(() => {}));

    const out = await matchCardCandidates([ing], db, gemini, {
      deadlineAt: Date.now() + 1_100,
    });

    expect(out).toBe(MATCH_EXPIRED);
  });

  it('passes the deadline to the backend choice and returns null to go legacy', async () => {
    resolveCardBackend.mockResolvedValue(null);
    const deadlineAt = Date.now() + 5_000;
    expect(
      await matchCardCandidates([ing], db, gemini, { deadlineAt })
    ).toBeNull();
    expect(resolveCardBackend.mock.calls[0][1]).toBe(deadlineAt);
  });

  it('expires without embedding when an already-loaded catalog comes back late', async () => {
    const search = vi.fn();
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search,
    });

    const out = await matchCardCandidates([ing], db, gemini, {
      deadlineAt: Date.now() - 1,
    });

    expect(out).toBe(MATCH_EXPIRED);
    expect(gemini.generateEmbeddingBatch).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('starts no embedding when the nutrition reserve takes the whole budget', async () => {
    const search = vi.fn();
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search,
    });

    const out = await matchCardCandidates([ing], db, gemini, {
      deadlineAt: Date.now() + 800,
    });

    expect(gemini.generateEmbeddingBatch).not.toHaveBeenCalled();
    const [result] = out as Exclude<typeof out, null | typeof MATCH_EXPIRED>;
    expect(result.retrieval?.vectorSource).toBe('none');
    expect(result.candidates.length).toBeGreaterThan(0); // the lexical arms
  });

  it('records no vector search when the embedding used up the budget', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    const search = vi.fn();
    resolveCardBackend.mockResolvedValue({
      kind: 'index',
      catalog,
      build: 'b1',
      search,
    });
    let land: (v: number[][]) => void = () => {};
    const slow = {
      generateEmbeddingBatch: vi.fn(
        () =>
          new Promise<number[][]>((resolve) => {
            land = resolve;
          })
      ),
    } as unknown as GeminiClient;

    // 1.1 s left: the arm gets 100 ms after the nutrition reserve.
    const pending = matchCardCandidates([ing], db, slow, {
      deadlineAt: Date.now() + 1_100,
    });
    await vi.advanceTimersByTimeAsync(0);
    // The clock passes the arm's budget before its timeout callback runs,
    // and the embedding lands in that gap.
    vi.setSystemTime(Date.now() + 150);
    land([[0.1], [0.1], [0.1], [0.1]]);
    await vi.advanceTimersByTimeAsync(0);
    const out = await pending;
    vi.useRealTimers();

    expect(search).not.toHaveBeenCalled();
    const [result] = out as Exclude<typeof out, null | typeof MATCH_EXPIRED>;
    expect(result.retrieval?.vectorSource).toBe('none');
  });
});
