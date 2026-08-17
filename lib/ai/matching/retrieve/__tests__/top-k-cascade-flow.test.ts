import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMemoryCache } from '@/lib/ai/cache/embedding-cache';
import { clearNutritionCache } from '@/lib/ai/cache/nutrition-cache';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';
import { matchTopKPerIngredient } from '../top-k-cascade';

function sqlText(query: unknown): string {
  return JSON.stringify(query);
}

function ing(canonicalName: string): DecomposedIngredientV2 {
  return { rawName: canonicalName, canonicalName } as DecomposedIngredientV2;
}

/**
 * Routing mock DB. Each arm returns configurable rows so a test can force an
 * exact hit, a fuzzy-only hit, etc.
 */
function routingDb(opts: {
  exact?: unknown[];
  vector?: unknown[];
  fuzzy?: unknown[];
  nutrition?: unknown[];
}): { db: AppDb; execute: ReturnType<typeof vi.fn> } {
  const execute = vi.fn().mockImplementation((query: unknown) => {
    const t = sqlText(query);
    // Check fuzzy first: its function name CONTAINS "match_ingredients_all_sources"
    // as a substring, so the vector check must not shadow it.
    if (t.includes('fuzzy_match_ingredients_all_sources')) {
      return Promise.resolve(opts.fuzzy ?? []);
    }
    if (t.includes('match_ingredients_all_sources')) {
      return Promise.resolve(opts.vector ?? []);
    }
    if (t.includes('ingredient_query_embeddings')) {
      return Promise.resolve([]); // L2 miss → live embed path
    }
    if (
      t.includes('vietnamese_food_composition') &&
      t.includes('name_primary')
    ) {
      return Promise.resolve(opts.exact ?? []); // exact-match lookup
    }
    if (t.includes('WHERE id IN')) {
      return Promise.resolve(opts.nutrition ?? []);
    }
    // Bulk warm / inedible / synonym-candidate etc.
    return Promise.resolve([]);
  });
  return { db: { execute } as unknown as AppDb, execute };
}

const EMBED = Array(768).fill(0.1);

function gemini(batch: () => Promise<number[][]>): {
  g: GeminiClient;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn().mockImplementation(batch);
  return {
    g: {
      generateEmbeddingBatch: spy,
      generateEmbedding: vi.fn().mockResolvedValue(EMBED),
    } as unknown as GeminiClient,
    spy,
  };
}

beforeEach(() => {
  clearMemoryCache();
  clearNutritionCache();
});
afterEach(() => vi.restoreAllMocks());

describe('matchTopKPerIngredient — exact/alias-first + lexical fallback', () => {
  it('exact match short-circuits: candidate returned, NO embedding batch call', async () => {
    const { db } = routingDb({
      exact: [
        {
          id: 'fao_vn_2007_8051_raw',
          name_primary: 'Tôm biển',
          state: 'raw',
        },
      ],
      nutrition: [
        { id: 'fao_vn_2007_8051_raw', calories_kcal: 90, protein_g: 20 },
      ],
    });
    const { g, spy } = gemini(async () => [EMBED]);

    const results = await matchTopKPerIngredient([ing('Tôm')], [null], db, g);

    expect(results).toHaveLength(1);
    expect(results[0].candidates).toHaveLength(1);
    expect(results[0].candidates[0].info.foodCompositionId).toBe(
      'fao_vn_2007_8051_raw'
    );
    expect(results[0].candidates[0].info.similarity).toBe(1);
    expect(results[0].candidates[0].nutrition?.caloriesKcal).toBe(90);
    // The whole point: no embedding round-trip for an exact hit.
    expect(spy).not.toHaveBeenCalled();
  });

  it('embedding batch FAILURE degrades to the lexical (fuzzy) arm, not zero candidates', async () => {
    const { db } = routingDb({
      exact: [], // no exact hit → cascade
      fuzzy: [
        {
          id: 'fao_vn_2007_1013_raw',
          name_primary: 'Bánh phở',
          name_alt: null,
          name_en: 'Rice noodles',
          state: 'raw',
          similarity: 0.92,
          source_id: 1,
        },
      ],
      nutrition: [
        {
          id: 'fao_vn_2007_1013_raw',
          calories_kcal: 143,
          carbohydrate_g: 31.7,
        },
      ],
    });
    // Gemini embedding batch throws — the availability hole this plugs.
    const { g } = gemini(async () => {
      throw new Error('gemini timeout');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const results = await matchTopKPerIngredient(
      [ing('Phở khô')],
      [null],
      db,
      g
    );

    expect(results[0].candidates.length).toBeGreaterThan(0);
    expect(results[0].candidates[0].info.foodCompositionId).toBe(
      'fao_vn_2007_1013_raw'
    );
    expect(results[0].candidates[0].info.matchType).toBe('fuzzy');
  });

  it('normal path: L3 embed → hybrid vector+fuzzy still works', async () => {
    const { db } = routingDb({
      exact: [],
      vector: [
        {
          id: 'v1',
          name_primary: 'Ức gà',
          name_alt: null,
          name_en: 'Chicken breast',
          state: 'cooked',
          similarity: 0.9,
          source_id: 1,
        },
      ],
      nutrition: [{ id: 'v1', calories_kcal: 165, protein_g: 31 }],
    });
    const { g, spy } = gemini(async () => [EMBED]);

    const results = await matchTopKPerIngredient(
      [ing('Ức gà nướng')],
      [null],
      db,
      g
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(results[0].candidates[0].info.foodCompositionId).toBe('v1');
  });
});
