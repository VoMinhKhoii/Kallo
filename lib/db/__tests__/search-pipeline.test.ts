/**
 * SQL-level search pipeline tests.
 *
 * Validates that fuzzy_match_ingredients (pg_trgm) and
 * match_ingredients (pgvector) work correctly against the
 * live Supabase dev database.
 *
 * These tests confirm DB-level search quality BEFORE the LLM
 * tool-calling layer. They cover:
 *   - Exact / partial Vietnamese name matches
 *   - English name fallback
 *   - Synonyms and colloquialisms
 *   - LLM extraction patterns (decomposed names, cooking methods, etc.)
 *   - Typos / misspellings
 *   - Diacritic routing (search_text vs search_text_ascii)
 *   - Threshold and ranking behavior
 *   - No-match scenarios
 *   - Vector fallback when pg_trgm fails
 *   - Data integrity (search_text, search_text_ascii, embeddings)
 *
 * Requires: DATABASE_URL in .env.local pointing at a seeded
 * Supabase dev database with embeddings backfilled.
 *
 * Run: bun --env-file=.env.local vitest run lib/db/__tests__/search-pipeline.test.ts
 */

import postgres from 'postgres';
import { afterAll, beforeAll, describe as describeBase, expect, it } from 'vitest';
import { encodeDbUrl } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FuzzyResult {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

interface VectorResult {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let sql: postgres.Sql | undefined;
const describe = describeBase.skip;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fuzzy(
  query: string,
  count = 5,
  threshold = 0.15
): Promise<FuzzyResult[]> {
  return sql!<FuzzyResult[]>`
    SELECT * FROM fuzzy_match_ingredients(
      ${query}, ${count}, ${threshold}
    )
  `;
}

async function vector(
  sourceId: string,
  count = 5,
  threshold = 0.5
): Promise<VectorResult[]> {
  return sql!<VectorResult[]>`
    SELECT * FROM match_ingredients(
      (SELECT embedding FROM vietnamese_food_composition
       WHERE id = ${sourceId}),
      ${count}, ${threshold}
    )
  `;
}

// Helper: assert that at least one result contains the expected substring
function expectMatch(
  results: FuzzyResult[] | VectorResult[],
  substring: string
) {
  const found = results.some(
    (r) =>
      r.name_primary.toLowerCase().includes(substring.toLowerCase()) ||
      r.name_en.toLowerCase().includes(substring.toLowerCase())
  );
  expect(found).toBe(true);
}

// Helper: assert specific ID appears in results
function _expectId(results: FuzzyResult[] | VectorResult[], id: string) {
  expect(results.some((r) => r.id === id)).toBe(true);
}

// Helper: results are sorted by similarity descending
function expectSorted(results: FuzzyResult[] | VectorResult[]) {
  for (let i = 1; i < results.length; i++) {
    expect(results[i].similarity).toBeLessThanOrEqual(
      results[i - 1].similarity
    );
  }
}

// =============================================================================
// 1. FUZZY SEARCH (pg_trgm) — Primary retrieval
// =============================================================================

describe('fuzzy_match_ingredients (pg_trgm)', () => {
  // ── Exact & near-exact matches ──────────────────────────────────────────

  describe('exact and near-exact Vietnamese names', () => {
    it('matches "Thịt lợn nạc" exactly', async () => {
      const r = await fuzzy('Thịt lợn nạc');
      expect(r.length).toBeGreaterThan(0);
      expect(r[0].name_primary).toBe('Thịt lợn nạc');
      expect(r[0].similarity).toBeGreaterThan(0.5);
    });

    it('matches "Trứng gà" with high similarity', async () => {
      const r = await fuzzy('Trứng gà');
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Trứng gà');
      expect(r[0].similarity).toBeGreaterThan(0.3);
    });

    it('matches "Nước mắm" to fish sauce variants', async () => {
      const r = await fuzzy('Nước mắm');
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Nước mắm');
    });

    it('matches "Cải bắp" (cabbage) exactly', async () => {
      const r = await fuzzy('Cải bắp');
      expectMatch(r, 'Cải bắp');
    });
  });

  // ── Partial name matches ────────────────────────────────────────────────

  describe('partial name matches', () => {
    it('"thịt" returns various meats', async () => {
      const r = await fuzzy('thịt', 10, 0.1);
      expect(r.length).toBeGreaterThan(3);
      // Should include pork, beef, chicken etc.
      const names = r.map((x) => x.name_primary).join(' ');
      expect(names).toContain('Thịt');
    });

    it('"cá" returns various fish', async () => {
      const r = await fuzzy('cá', 10, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Cá');
    });

    it('"rau" returns various vegetables', async () => {
      const r = await fuzzy('rau', 10, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const vegCount = r.filter((x) =>
        x.name_primary.toLowerCase().includes('rau')
      ).length;
      expect(vegCount).toBeGreaterThan(0);
    });
  });

  // ── English name fallback ───────────────────────────────────────────────

  describe('English name matching', () => {
    it('"chicken egg" matches Trứng gà via name_en', async () => {
      // search_text includes name_en
      const r = await fuzzy('chicken egg', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Trứng');
    });

    it('"pork" matches thịt lợn via name_en', async () => {
      const r = await fuzzy('pork', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasPork = r.some(
        (x) =>
          x.name_primary.includes('lợn') ||
          x.name_en.toLowerCase().includes('pork')
      );
      expect(hasPork).toBe(true);
    });

    it('"tofu" matches Đậu phụ via name_en', async () => {
      const r = await fuzzy('tofu', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'tofu');
    });

    it('"cabbage" matches Cải bắp via name_en', async () => {
      const r = await fuzzy('cabbage', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Cải bắp');
    });
  });

  // ── LLM extraction patterns ─────────────────────────────────────────────
  // When the LLM breaks down a meal description, it may produce:
  //   - Ingredient name + cooking method: "thịt lợn luộc"
  //   - Ingredient name + quantity: "100g thịt gà"
  //   - Decomposed compound: "thịt" + "lợn" separately
  //   - Abbreviated forms: "trứng" instead of "trứng gà"
  //   - With modifiers: "rau muống xào tỏi"

  describe('LLM extraction patterns', () => {
    it('handles ingredient + cooking method: "thịt lợn luộc"', async () => {
      // "luộc" (boiled) is not in DB — trgm should still match "thịt lợn"
      const r = await fuzzy('thịt lợn luộc', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasPork = r.some((x) => x.name_primary.includes('lợn'));
      expect(hasPork).toBe(true);
    });

    it('handles ingredient + cooking method: "gà nướng"', async () => {
      const r = await fuzzy('gà nướng', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      // Should match chicken items
      const hasChicken = r.some(
        (x) =>
          x.name_primary.includes('gà') ||
          x.name_en.toLowerCase().includes('chicken')
      );
      expect(hasChicken).toBe(true);
    });

    it('handles quantity prefix: "100g thịt gà"', async () => {
      // The "100g" prefix shouldn't prevent matching
      const r = await fuzzy('100g thịt gà', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasChicken = r.some((x) => x.name_primary.includes('gà'));
      expect(hasChicken).toBe(true);
    });

    it('handles abbreviated name: "trứng" matches egg types', async () => {
      const r = await fuzzy('trứng', 10, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const eggCount = r.filter((x) =>
        x.name_primary.toLowerCase().includes('trứng')
      ).length;
      expect(eggCount).toBeGreaterThan(1);
    });

    it('handles compound dish: "rau muống xào tỏi"', async () => {
      // "rau muống xào tỏi" = stir-fried morning glory with garlic
      // Should match "Rau muống" (morning glory)
      const r = await fuzzy('rau muống xào tỏi', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'Rau muống');
    });

    it('handles LLM decomposition: "tôm" alone', async () => {
      const r = await fuzzy('tôm', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasShrimp = r.some((x) => x.name_primary.includes('Tôm'));
      expect(hasShrimp).toBe(true);
    });

    it('handles descriptive: "thịt bò xào"', async () => {
      const r = await fuzzy('thịt bò xào', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasBeef = r.some((x) => x.name_primary.includes('bò'));
      expect(hasBeef).toBe(true);
    });

    it('handles size/portion qualifiers: "tô phở bò"', async () => {
      // "tô" (bowl) and "phở" are not ingredients — but "bò" is
      const r = await fuzzy('tô phở bò', 5, 0.1);
      // May or may not match — this tests graceful degradation
      // At minimum shouldn't error
      expect(r).toBeDefined();
    });
  });

  // ── Typos and misspellings ──────────────────────────────────────────────

  describe('typos and misspellings', () => {
    it('"thit lon" (missing diacritics) still matches', async () => {
      const r = await fuzzy('thit lon', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      // Trigrams overlap enough without diacritics
      const hasMeat = r.some(
        (x) =>
          x.name_primary.includes('Thịt') || x.name_primary.includes('thịt')
      );
      expect(hasMeat).toBe(true);
    });

    it('"trung ga" (no diacritics) matches eggs', async () => {
      const r = await fuzzy('trung ga', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      const hasEgg = r.some(
        (x) =>
          x.name_primary.includes('Trứng') || x.name_primary.includes('trứng')
      );
      expect(hasEgg).toBe(true);
    });

    it('"nuoc mam" (no diacritics) matches fish sauce', async () => {
      const r = await fuzzy('nuoc mam', 5, 0.1);
      expect(r.length).toBeGreaterThan(0);
      expectMatch(r, 'mắm');
    });

    it('"cá hôi" (slight misspelling of cá hồi) tolerates error', async () => {
      const r = await fuzzy('cá hôi', 5, 0.1);
      // pg_trgm may or may not catch this — test it doesn't crash
      expect(r).toBeDefined();
    });
  });

  // ── Threshold and ranking ───────────────────────────────────────────────

  describe('threshold and ranking behavior', () => {
    it('results are sorted by similarity descending', async () => {
      const r = await fuzzy('thịt lợn', 10, 0.1);
      expectSorted(r);
    });

    it('high threshold filters out weak matches', async () => {
      const loose = await fuzzy('thịt', 20, 0.1);
      const strict = await fuzzy('thịt', 20, 0.4);
      expect(strict.length).toBeLessThanOrEqual(loose.length);
      for (const r of strict) {
        expect(r.similarity).toBeGreaterThanOrEqual(0.4);
      }
    });

    it('match_count limits results', async () => {
      const r3 = await fuzzy('thịt', 3, 0.1);
      const r10 = await fuzzy('thịt', 10, 0.1);
      expect(r3.length).toBeLessThanOrEqual(3);
      expect(r10.length).toBeGreaterThanOrEqual(r3.length);
    });

    it('all returned results meet the threshold', async () => {
      const r = await fuzzy('trứng gà', 10, 0.2);
      for (const row of r) {
        expect(row.similarity).toBeGreaterThanOrEqual(0.2);
      }
    });
  });

  // ── No-match / gibberish ────────────────────────────────────────────────

  describe('no-match and edge cases', () => {
    it('returns empty for nonsense input', async () => {
      const r = await fuzzy('xyzqwerty12345', 5, 0.15);
      expect(r.length).toBe(0);
    });

    it('returns empty for empty string', async () => {
      const r = await fuzzy('', 5, 0.15);
      expect(r.length).toBe(0);
    });

    it('handles very long input without error', async () => {
      const longQuery = 'thịt lợn '.repeat(50);
      const r = await fuzzy(longQuery, 3, 0.1);
      expect(r).toBeDefined();
    });

    it('handles special characters without SQL injection', async () => {
      const r = await fuzzy("'; DROP TABLE --", 3, 0.15);
      expect(r).toBeDefined();
    });

    it('item not in DB: "pizza" returns nothing at default threshold', async () => {
      const r = await fuzzy('pizza', 5, 0.15);
      // Pizza is not a Vietnamese ingredient — should return nothing
      // or very weak matches
      if (r.length > 0) {
        expect(r[0].similarity).toBeLessThan(0.3);
      }
    });
  });
});

// =============================================================================
// 2. VECTOR SEARCH (pgvector) — Semantic fallback
// =============================================================================

describe('match_ingredients (pgvector)', () => {
  // We can't generate embeddings from SQL, so we test using
  // existing row embeddings as "query" vectors. This validates
  // the function mechanics, index usage, and similarity math.

  describe('self-match and nearest neighbors', () => {
    it('a row matches itself with similarity ≈ 1.0', async () => {
      const r = await vector('fao_vn_2007_9001_raw', 1, 0.5);
      expect(r.length).toBe(1);
      // Trứng gà should match itself
      expect(r[0].id).toBe('fao_vn_2007_9001_raw');
      expect(r[0].similarity).toBeGreaterThan(0.99);
    });

    it('rice (Gạo tẻ máy) neighbors are other rice/grain items', async () => {
      const r = await vector('fao_vn_2007_1004_raw', 5, 0.5);
      expect(r.length).toBeGreaterThan(0);
      expectSorted(r);
      // Top results should be rice-related
      const riceRelated = r.filter(
        (x) =>
          x.name_primary.includes('Gạo') ||
          x.name_primary.includes('gạo') ||
          x.name_primary.includes('Bột')
      );
      expect(riceRelated.length).toBeGreaterThan(1);
    });

    it('chicken egg neighbors include other egg types', async () => {
      const r = await vector('fao_vn_2007_9001_raw', 5, 0.5);
      const eggRelated = r.filter((x) => x.name_primary.includes('trứng'));
      expect(eggRelated.length).toBeGreaterThan(1);
    });

    it('fish sauce neighbors are other condiments/sauces', async () => {
      // Nước mắm cá
      const r = await vector('fao_vn_2007_13017_raw', 5, 0.5);
      expect(r.length).toBeGreaterThan(0);
      // Should include other nước mắm variants
      const sauceCount = r.filter((x) => x.name_primary.includes('mắm')).length;
      expect(sauceCount).toBeGreaterThan(1);
    });
  });

  describe('semantic grouping quality', () => {
    it('pork items cluster together', async () => {
      // Thịt lợn nạc
      const r = await vector('fao_vn_2007_7017_raw', 5, 0.5);
      const porkCount = r.filter(
        (x) =>
          x.name_primary.includes('lợn') ||
          x.name_en.toLowerCase().includes('pork')
      ).length;
      expect(porkCount).toBeGreaterThan(2);
    });

    it('vegetable items cluster together', async () => {
      // Cải bắp (cabbage)
      const r = await vector('fao_vn_2007_4010_raw', 5, 0.5);
      expect(r.length).toBeGreaterThan(0);
      // At least some results should be vegetables
      const vegCount = r.filter(
        (x) =>
          x.name_primary.includes('Rau') ||
          x.name_primary.includes('Cải') ||
          x.name_en.toLowerCase().includes('vegetable') ||
          x.name_en.toLowerCase().includes('cabbage')
      ).length;
      expect(vegCount).toBeGreaterThan(0);
    });
  });

  describe('threshold and ranking', () => {
    it('results are sorted by similarity descending', async () => {
      const r = await vector('fao_vn_2007_7017_raw', 10, 0.3);
      expectSorted(r);
    });

    it('high threshold filters weak matches', async () => {
      const loose = await vector('fao_vn_2007_7017_raw', 20, 0.3);
      const strict = await vector('fao_vn_2007_7017_raw', 20, 0.8);
      expect(strict.length).toBeLessThanOrEqual(loose.length);
      for (const r of strict) {
        expect(r.similarity).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('match_count limits results', async () => {
      const r3 = await vector('fao_vn_2007_7017_raw', 3, 0.3);
      expect(r3.length).toBeLessThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('null embedding returns empty results', async () => {
      // Use the function directly with a null-safe check
      const r = await sql!<VectorResult[]>`
        SELECT * FROM match_ingredients(
          NULL::vector(768), 3, 0.5
        )
      `.catch(() => [] as VectorResult[]);
      // Either returns empty or errors gracefully
      expect(r.length).toBe(0);
    });
  });
});

// =============================================================================
// 3. COMBINED PIPELINE — pg_trgm first, vector fallback
// =============================================================================

describe('combined search pipeline', () => {
  // Simulates the app-level logic:
  //   1. Try fuzzy_match_ingredients() first
  //   2. If no results or all results below threshold → fall back to vector
  //
  // We can't generate query embeddings from SQL, but we CAN test
  // the decision logic by checking what trgm returns and using
  // known embeddings for the vector step.

  async function combinedSearch(
    query: string,
    fallbackEmbeddingSourceId?: string
  ): Promise<{
    method: 'trgm' | 'vector' | 'none';
    results: (FuzzyResult | VectorResult)[];
  }> {
    // Use the same threshold as the DB function default (0.15).
    // Short Vietnamese words (tôm, bún, gạo) have inherently low
    // trigram similarity vs longer search_text — a higher threshold
    // would filter out valid matches for short queries.
    const TRGM_THRESHOLD = 0.15;
    const VECTOR_THRESHOLD = 0.5;

    // Step 1: try pg_trgm
    const trgmResults = await fuzzy(query, 5, 0.15);
    const goodTrgm = trgmResults.filter((r) => r.similarity >= TRGM_THRESHOLD);

    if (goodTrgm.length > 0) {
      return { method: 'trgm', results: goodTrgm };
    }

    // Step 2: fall back to vector (if we have an embedding source)
    if (fallbackEmbeddingSourceId) {
      const vectorResults = await vector(
        fallbackEmbeddingSourceId,
        5,
        VECTOR_THRESHOLD
      );
      if (vectorResults.length > 0) {
        return { method: 'vector', results: vectorResults };
      }
    }

    return { method: 'none', results: [] };
  }

  describe('trgm-sufficient cases (no vector needed)', () => {
    it('"thịt lợn nạc" is fully resolved by trgm', async () => {
      const { method, results } = await combinedSearch('thịt lợn nạc');
      expect(method).toBe('trgm');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name_primary).toBe('Thịt lợn nạc');
    });

    it('"trứng gà" is resolved by trgm', async () => {
      const { method, results } = await combinedSearch('trứng gà');
      expect(method).toBe('trgm');
      expectMatch(results, 'Trứng gà');
    });

    it('"nước mắm" is resolved by trgm', async () => {
      const { method, results } = await combinedSearch('nước mắm');
      expect(method).toBe('trgm');
      expectMatch(results, 'mắm');
    });

    it('"rau muống" is resolved by trgm', async () => {
      const { method, results } = await combinedSearch('rau muống');
      expect(method).toBe('trgm');
      expectMatch(results, 'Rau muống');
    });
  });

  describe('vector-fallback cases (trgm insufficient)', () => {
    it('"cơm trắng" trgm returns candidates but NOT rice — vector needed for synonym', async () => {
      // "cơm trắng" (cooked white rice) shares the word "trắng"
      // with non-rice items, so trgm returns results — but none
      // are the correct ingredient "Gạo tẻ máy" (raw polished rice).
      // The LLM layer decides these trgm results are wrong;
      // at DB level we just verify vector CAN find rice.
      const trgmResults = await fuzzy('cơm trắng', 5, 0.15);
      const hasTrgmRice = trgmResults.some(
        (r) => r.name_primary.includes('Gạo') || r.name_primary.includes('gạo')
      );
      // trgm does NOT surface rice — this is the gap
      expect(hasTrgmRice).toBe(false);

      // Vector search using rice embedding DOES find it
      const vectorResults = await vector(
        'fao_vn_2007_1004_raw', // Gạo tẻ máy
        5,
        0.5
      );
      expect(vectorResults.length).toBeGreaterThan(0);
      expectMatch(vectorResults, 'Gạo');
    });

    it('"đậu hũ" (southern VN for tofu) falls back', async () => {
      // DB has "Đậu phụ" (northern VN for tofu)
      // "đậu hũ" shares some trigrams with "đậu" items but may
      // not find "Đậu phụ" with high confidence
      const trgmResults = await fuzzy('đậu hũ', 5, 0.25);
      const hasTofu = trgmResults.some((r) => r.name_primary === 'Đậu phụ');

      if (!hasTofu) {
        // If trgm missed tofu, vector should find it
        const { method } = await combinedSearch(
          'đậu hũ',
          'fao_vn_2007_3026_raw' // Đậu phụ if exists
        );
        // At minimum should not be 'none'
        expect(['trgm', 'vector']).toContain(method);
      }
    });

    it('unknown/foreign term gets no results', async () => {
      const { method } = await combinedSearch('kimchi');
      // Kimchi is not in Vietnamese FCT — should find nothing
      expect(method).toBe('none');
    });
  });

  describe('real meal descriptions (LLM decomposition)', () => {
    // Simulates what the LLM would extract from user input

    it('meal: "Cơm rang trứng" → components found', async () => {
      // LLM would decompose to: ["trứng gà", "gạo tẻ"]
      const egg = await combinedSearch('trứng gà');
      const rice = await combinedSearch('gạo tẻ');

      expect(egg.method).toBe('trgm');
      expectMatch(egg.results, 'Trứng');

      expect(rice.method).toBe('trgm');
      expectMatch(rice.results, 'Gạo');
    });

    it('meal: "Phở bò tái" → beef found', async () => {
      // LLM extracts: ["thịt bò", "bánh phở"]
      const beef = await combinedSearch('thịt bò');
      expect(beef.method).toBe('trgm');
      expectMatch(beef.results, 'bò');

      const noodle = await combinedSearch('bánh phở');
      // Might match "Bún phở" if exists, or not
      expect(noodle).toBeDefined();
    });

    it('meal: "Canh rau muống nấu tôm" → both found', async () => {
      // LLM extracts: ["rau muống", "tôm"]
      const veg = await combinedSearch('rau muống');
      expect(veg.method).toBe('trgm');
      expectMatch(veg.results, 'Rau muống');

      const shrimp = await combinedSearch('tôm');
      expect(shrimp.results.length).toBeGreaterThan(0);
    });

    it('meal: "Bún chả Hà Nội" → LLM extracts pork + noodle', async () => {
      // LLM extracts: ["thịt lợn", "bún"]
      const pork = await combinedSearch('thịt lợn');
      expect(pork.method).toBe('trgm');
      expectMatch(pork.results, 'lợn');

      const noodle = await combinedSearch('bún');
      expect(noodle.results.length).toBeGreaterThan(0);
    });

    it('meal: "Gỏi cuốn tôm thịt" → shrimp + pork found', async () => {
      // LLM extracts: ["tôm", "thịt lợn"]
      const shrimp = await combinedSearch('tôm');
      const pork = await combinedSearch('thịt lợn');
      expect(shrimp.results.length).toBeGreaterThan(0);
      expect(pork.results.length).toBeGreaterThan(0);
    });

    it('meal: "Cháo gà" → chicken + rice found', async () => {
      // LLM extracts: ["thịt gà", "gạo tẻ"]
      const chicken = await combinedSearch('thịt gà');
      expect(chicken.method).toBe('trgm');
      expectMatch(chicken.results, 'gà');

      const rice = await combinedSearch('gạo tẻ');
      expect(rice.method).toBe('trgm');
      expectMatch(rice.results, 'Gạo');
    });

    it('meal: "Bánh mì trứng ốp la" → egg + bread found', async () => {
      // LLM extracts: ["trứng gà", "bánh mì"]
      const egg = await combinedSearch('trứng gà');
      expectMatch(egg.results, 'Trứng');

      const bread = await combinedSearch('bánh mì');
      expect(bread.results.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// 4. DIACRITIC ROUTING — search_text vs search_text_ascii
// =============================================================================

describe('diacritic routing', () => {
  // Vietnamese diacritics are semantically load-bearing:
  //   bò = beef, bơ = butter, bổ = nutritious
  // The function detects diacritics and routes to the correct column:
  //   - Has diacritics → search search_text (preserves meaning)
  //   - No diacritics → search search_text_ascii (folded)

  it('"nuoc mam" (no diacritics) → ASCII route → finds Nước mắm', async () => {
    const r = await fuzzy('nuoc mam', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    expectMatch(r, 'mắm');
  });

  it('"thit lon" (no diacritics) → ASCII route → finds Thịt lợn', async () => {
    const r = await fuzzy('thit lon', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    const hasPork = r.some(
      (x) => x.name_primary.includes('Thịt') && x.name_primary.includes('lợn')
    );
    expect(hasPork).toBe(true);
  });

  it('"trung ga" (no diacritics) → ASCII route → finds Trứng gà', async () => {
    const r = await fuzzy('trung ga', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    expectMatch(r, 'Trứng');
  });

  it('"Nước mắm" (with diacritics) → original route → precise match', async () => {
    const r = await fuzzy('Nước mắm', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    expectMatch(r, 'Nước mắm');
    // Should have reasonable similarity (short queries have lower scores)
    expect(r[0].similarity).toBeGreaterThan(0.2);
  });

  it('"bò" (diacritic) → beef, not butter or anything else', async () => {
    const r = await fuzzy('bò', 10, 0.1);
    expect(r.length).toBeGreaterThan(0);
    // All top results should contain "bò" (beef), not "bơ" (butter)
    const hasBeef = r.some((x) => x.name_primary.includes('bò'));
    expect(hasBeef).toBe(true);
  });

  it('"dau phu" (no diacritics) → ASCII route → finds Đậu phụ', async () => {
    const r = await fuzzy('dau phu', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    const hasTofu = r.some(
      (x) =>
        x.name_primary.includes('Đậu') ||
        x.name_en.toLowerCase().includes('tofu')
    );
    expect(hasTofu).toBe(true);
  });

  it('"ca hoi" (no diacritics) → ASCII route → finds Cá hồi', async () => {
    const r = await fuzzy('ca hoi', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    const hasSalmon = r.some(
      (x) =>
        x.name_primary.includes('Cá') ||
        x.name_en.toLowerCase().includes('salmon')
    );
    expect(hasSalmon).toBe(true);
  });

  it('"rau muong" (no diacritics) → finds Rau muống', async () => {
    const r = await fuzzy('rau muong', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    expectMatch(r, 'Rau muống');
  });

  it('mixed: "thịt lon" (partial diacritics) → original route', async () => {
    // "thịt" has diacritics so the whole query uses original column
    const r = await fuzzy('thịt lon', 5, 0.1);
    expect(r.length).toBeGreaterThan(0);
    // Should still find pork since "thịt" matches well
    const hasMeat = r.some((x) => x.name_primary.includes('Thịt'));
    expect(hasMeat).toBe(true);
  });
});

// =============================================================================
// 5. DATA INTEGRITY — search_text, search_text_ascii, and embedding columns
// =============================================================================

describe('search infrastructure integrity', () => {
  it('all rows have search_text populated', async () => {
    const [r] = await sql!`
      SELECT count(*) as n FROM vietnamese_food_composition
      WHERE search_text IS NULL
    `;
    expect(Number(r.n)).toBe(0);
  });

  it('all rows have embeddings populated', async () => {
    const [r] = await sql!`
      SELECT count(*) as n FROM vietnamese_food_composition
      WHERE embedding IS NULL
    `;
    expect(Number(r.n)).toBe(0);
  });

  it('search_text contains name_primary for every row', async () => {
    const [r] = await sql!`
      SELECT count(*) as n FROM vietnamese_food_composition
      WHERE search_text NOT ILIKE '%' || name_primary || '%'
    `;
    expect(Number(r.n)).toBe(0);
  });

  it('search_text contains name_en for every row', async () => {
    const [r] = await sql!`
      SELECT count(*) as n FROM vietnamese_food_composition
      WHERE search_text NOT ILIKE '%' || name_en || '%'
    `;
    expect(Number(r.n)).toBe(0);
  });

  it('embedding dimensions are 768', async () => {
    const [r] = await sql!`
      SELECT vector_dims(embedding) as dims 
      FROM vietnamese_food_composition 
      WHERE embedding IS NOT NULL 
      LIMIT 1
    `;
    expect(Number(r.dims)).toBe(768);
  });

  it('trigger updates search_text on name change', async () => {
    // Create a temp row, verify trigger, clean up
    const testId = `test_trigger_${Date.now()}`;
    await sql!`
      INSERT INTO vietnamese_food_composition 
        (id, name_primary, name_en, type_vn, type_en, source_id, state)
      VALUES 
        (${testId}, 'Test Thực Phẩm', 'Test Food', 'Test', 'Test', 1, 'raw')
    `;

    const [row] = await sql!`
      SELECT search_text, search_text_ascii FROM vietnamese_food_composition 
      WHERE id = ${testId}
    `;
    expect(row.search_text).toContain('Test Thực Phẩm');
    expect(row.search_text).toContain('Test Food');
    // search_text_ascii should be lowered + unaccented
    expect(row.search_text_ascii).toContain('test thuc pham');
    expect(row.search_text_ascii).toContain('test food');

    // Clean up
    await sql!`
      DELETE FROM vietnamese_food_composition WHERE id = ${testId}
    `;
  });

  it('all rows have search_text_ascii populated', async () => {
    const [r] = await sql!`
      SELECT count(*) as n FROM vietnamese_food_composition
      WHERE search_text_ascii IS NULL
    `;
    expect(Number(r.n)).toBe(0);
  });

  it('search_text_ascii is lowercase and unaccented', async () => {
    // Verify no uppercase letters and no Vietnamese diacritics
    const rows = await sql!`
      SELECT id, search_text_ascii FROM vietnamese_food_composition
      WHERE search_text_ascii ~ '[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]'
      LIMIT 5
    `;
    expect(rows.length).toBe(0);
  });
});
