import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const resolveQueryEmbedding = vi.fn();
const cacheQueryEmbedding = vi.fn();
const generateEmbeddingBatch = vi.fn();

vi.mock('@/lib/infra/db/client', () => ({
  db: { execute },
}));

vi.mock('@/lib/ai/cache/embedding-cache', () => ({
  resolveQueryEmbedding,
  cacheQueryEmbedding,
}));

vi.mock('@/lib/ai/provider/provider', () => ({
  resolveGeminiProvider: () => ({ kind: 'test' }),
  createGeminiClient: () => ({ generateEmbeddingBatch }),
}));

const { searchIngredients } = await import('../ingredient-search');

// DB rows arrive snake_case with numeric columns as strings.
const riceDbRow = {
  id: 'fct-rice',
  name_primary: 'Cơm trắng',
  name_alt: ['cơm'],
  name_en: 'White rice',
  state: 'cooked',
  similarity: 0.92,
  calories_kcal: '130',
  protein_g: '2.7',
  carbohydrate_g: '28',
  fat_g: null,
};

/** The SQL text of the nth `db.execute` call, for asserting which arm ran. */
function sqlOfCall(index: number): string {
  return JSON.stringify(execute.mock.calls[index][0]);
}

beforeEach(() => {
  execute.mockReset();
  resolveQueryEmbedding.mockReset();
  cacheQueryEmbedding.mockReset();
  generateEmbeddingBatch.mockReset();
  // Default: no cached embedding and no live embedding → the semantic arm
  // degrades silently unless a test opts in.
  resolveQueryEmbedding.mockResolvedValue(null);
  generateEmbeddingBatch.mockResolvedValue([]);
});

describe('searchIngredients — row parsing', () => {
  it('maps a row, parsing the numeric strings the driver returns', async () => {
    // A full page of lexical hits — no supplemental query fires.
    execute.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({ ...riceDbRow, id: `fct-${i}` }))
    );

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'com trang',
      limit: 10,
    });

    expect(results).toHaveLength(10);
    expect(results[0]).toEqual({
      id: 'fct-0',
      namePrimary: 'Cơm trắng',
      nameEn: 'White rice',
      nameAlt: ['cơm'],
      state: 'cooked',
      similarity: 0.92,
      per100g: {
        caloriesKcal: 130,
        proteinG: 2.7,
        carbohydrateG: 28,
        fatG: null,
      },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('normalises a null or non-array name_alt to null', async () => {
    execute
      .mockResolvedValueOnce([
        { ...riceDbRow, id: 'null-alt', name_alt: null },
        { ...riceDbRow, id: 'string-alt', name_alt: 'com' },
      ])
      .mockResolvedValueOnce([]); // substring backfill

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'com trang',
      limit: 10,
    });

    expect(results.map((r) => r.nameAlt)).toEqual([null, null]);
  });

  it('carries a null name_en and null macros through as null', async () => {
    execute
      .mockResolvedValueOnce([
        {
          ...riceDbRow,
          name_en: null,
          calories_kcal: null,
          protein_g: null,
          carbohydrate_g: null,
        },
      ])
      .mockResolvedValueOnce([]); // substring backfill

    const [result] = await searchIngredients({
      userId: 'user-123',
      q: 'com trang',
      limit: 10,
    });

    expect(result.nameEn).toBeNull();
    expect(result.per100g).toEqual({
      caloriesKcal: null,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
    });
  });
});

describe('searchIngredients — recent foods', () => {
  it('returns the recents list, scoped to the user, when q is empty', async () => {
    // The recents projection has no `similarity` column at all.
    execute.mockResolvedValueOnce([
      { ...riceDbRow, similarity: undefined, last_used: new Date() },
    ]);

    const results = await searchIngredients({
      userId: 'user-123',
      q: '',
      limit: 10,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(sqlOfCall(0)).toContain('meal_items');
    expect(sqlOfCall(0)).toContain('user-123');
    // A recent is an exact pick, not a fuzzy match: similarity defaults to 1.
    expect(results[0].similarity).toBe(1);
  });
});

describe('searchIngredients — retrieval arms', () => {
  it('runs the word_similarity-ranked all-sources lexical function', async () => {
    execute.mockResolvedValueOnce([riceDbRow]).mockResolvedValueOnce([]); // substring backfill

    await searchIngredients({ userId: 'user-123', q: 'com trang', limit: 10 });

    // The whole-string-ranked `fuzzy_match_ingredients` buries body-part
    // entries ("ức gà") under short generic names; the all-sources function is
    // the one the v2 AI matcher shares.
    expect(sqlOfCall(0)).toContain('fuzzy_match_ingredients_all_sources');
  });

  it('supplements weak lexical results with flagged semantic matches', async () => {
    // Vocabulary gap: "lườn gà" shares no trigrams with breast entries.
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.2 }]) // weak lexical
      .mockResolvedValueOnce([
        { ...riceDbRow, similarity: 0.9 }, // duplicate of the lexical hit
        { ...riceDbRow, id: 'fct-breast', name_primary: 'Ức gà' },
      ])
      .mockResolvedValueOnce([]); // substring backfill

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'lườn gà',
      limit: 10,
    });

    expect(sqlOfCall(1)).toContain('match_ingredients');
    expect(results.map((r) => r.id)).toEqual(['fct-rice', 'fct-breast']);
    expect(results[0].semantic).toBeUndefined();
    expect(results[1].semantic).toBe(true);
  });

  it('live-embeds and caches when the query has no cached embedding', async () => {
    resolveQueryEmbedding.mockResolvedValue(null);
    generateEmbeddingBatch.mockResolvedValue([[0.5, 0.6]]);
    execute
      .mockResolvedValueOnce([]) // no lexical hits
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.8 }]) // vector
      .mockResolvedValueOnce([]); // substring backfill

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'lườn gà',
      limit: 10,
    });

    expect(generateEmbeddingBatch).toHaveBeenCalledWith(['lườn gà']);
    expect(cacheQueryEmbedding).toHaveBeenCalled();
    expect(results[0].semantic).toBe(true);
  });

  it('skips the embedding arm entirely for a 1-character query', async () => {
    execute
      .mockResolvedValueOnce([riceDbRow]) // lexical
      .mockResolvedValueOnce([]); // substring backfill

    await searchIngredients({ userId: 'user-123', q: 'g', limit: 10 });

    // Not even the cache lookup: a 1-char vector is noise.
    expect(resolveQueryEmbedding).not.toHaveBeenCalled();
    expect(generateEmbeddingBatch).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('degrades to lexical-only when the embedding lookup fails', async () => {
    resolveQueryEmbedding.mockRejectedValue(new Error('embed infra down'));
    execute
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.2 }]) // lexical
      .mockResolvedValueOnce([]); // substring backfill

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'lườn gà',
      limit: 10,
    });

    expect(results.map((r) => r.id)).toEqual(['fct-rice']);
  });

  it('degrades to lexical-only when the vector query itself throws', async () => {
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([{ ...riceDbRow, similarity: 0.2 }]) // lexical
      .mockRejectedValueOnce(new Error('vector infra down'))
      .mockResolvedValueOnce([]); // substring backfill

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'lườn gà',
      limit: 10,
    });

    expect(results.map((r) => r.id)).toEqual(['fct-rice']);
  });
});

describe('searchIngredients — substring backfill', () => {
  it('backfills a short-query result set, deduped against what ranked', async () => {
    execute
      .mockResolvedValueOnce([riceDbRow]) // lexical: one hit
      .mockResolvedValueOnce([
        riceDbRow, // duplicate of the lexical hit — must be dropped
        { ...riceDbRow, id: 'fct-rice-2', name_primary: 'Cơm gạo lứt' },
      ]);

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'cơm',
      limit: 10,
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(sqlOfCall(1)).toContain('search_text_ascii');
    expect(results.map((r) => r.id)).toEqual(['fct-rice', 'fct-rice-2']);
  });

  it('stops backfilling at the limit', async () => {
    execute
      .mockResolvedValueOnce(
        Array.from({ length: 9 }, (_, i) => ({ ...riceDbRow, id: `lex-${i}` }))
      )
      .mockResolvedValueOnce([
        { ...riceDbRow, id: 'sub-0' },
        { ...riceDbRow, id: 'sub-1' },
        { ...riceDbRow, id: 'sub-2' },
      ]);

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'com trang',
      limit: 10,
    });

    expect(results).toHaveLength(10);
    expect(results.at(-1)?.id).toBe('sub-0');
  });

  it('does not fire when the ranked list already fills the limit', async () => {
    resolveQueryEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    execute
      .mockResolvedValueOnce([
        { ...riceDbRow, id: 'lex-0' },
        { ...riceDbRow, id: 'lex-1' },
        { ...riceDbRow, id: 'lex-2' },
      ])
      .mockResolvedValueOnce([{ ...riceDbRow, id: 'sem-0' }]);

    const results = await searchIngredients({
      userId: 'user-123',
      q: 'ức gà',
      limit: 2,
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(results.map((r) => r.id)).toEqual(['sem-0', 'lex-0']);
  });
});
