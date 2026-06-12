import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { createGeminiClient, resolveGeminiProvider } from '@/lib/ai/gemini';
import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/matching/embedding-cache';
import { ingredientSearchQuerySchema } from '@/lib/api/contracts/ingredients';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import type { IngredientSearchResult } from '@/lib/logging/manual-logging';

export const runtime = 'nodejs';

// Vector matches below this cosine similarity are noise for a picker UI —
// kept deliberately strict (the AI pipeline accepts 0.7 for USDA; manual
// search prefers fewer, better suggestions over recall).
const SEMANTIC_VECTOR_THRESHOLD = 0.75;
// When the best lexical hit scores at least this, the query is well-covered
// lexically and the semantic supplement is skipped (no embedding work).
const LEXICAL_STRONG_SIMILARITY = 0.45;

function toSearchResult(row: Record<string, unknown>): IngredientSearchResult {
  return {
    id: String(row.id),
    namePrimary: String(row.name_primary),
    nameEn: row.name_en == null ? null : String(row.name_en),
    nameAlt: Array.isArray(row.name_alt) ? row.name_alt.map(String) : null,
    state: String(row.state),
    similarity: row.similarity == null ? 1 : Number(row.similarity),
    per100g: {
      caloriesKcal:
        row.calories_kcal == null ? null : Number(row.calories_kcal),
      proteinG: row.protein_g == null ? null : Number(row.protein_g),
      carbohydrateG:
        row.carbohydrate_g == null ? null : Number(row.carbohydrate_g),
      fatG: row.fat_g == null ? null : Number(row.fat_g),
    },
  };
}

/** The user's most recently logged ingredients — instant suggestions shown
 *  before they type (Cronometer-style "recent foods"). */
async function loadRecentIngredients(
  userId: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const rows = await db.execute(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g,
           MAX(m.logged_at) AS last_used
    FROM meal_items mi
    JOIN meals m ON m.id = mi.meal_id
    JOIN vietnamese_food_composition v ON v.id = mi.food_composition_id
    WHERE m.user_id = ${userId}
      -- Recents older than this aren't useful suggestions; the bound keeps the
      -- aggregation from scanning a user's lifetime history.
      AND m.logged_at > now() - interval '90 days'
    GROUP BY v.id
    ORDER BY last_used DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as Record<string, unknown>[]).map(toSearchResult);
}

/** Resolve a query embedding through the pipeline's 3-tier cache (memory →
 *  ingredient_query_embeddings → live Gemini embed call, cached on return). */
async function resolveEmbedding(q: string): Promise<number[] | null> {
  const cached = await resolveQueryEmbedding(q, db);
  if (cached) return cached;
  const gemini = createGeminiClient(resolveGeminiProvider());
  const [generated] = await gemini.generateEmbeddingBatch([q]);
  if (!generated) return null;
  cacheQueryEmbedding(q, generated, db);
  return generated;
}

/** Semantic supplement, reusing the AI pipeline's deterministic retrieval
 *  layer (cached embeddings + pgvector match_ingredients — NOT its LLM calls).
 *  Covers vocabulary the lexical index can't ("lườn gà" → chicken breast with
 *  zero shared trigrams). Strictly thresholded, and results are flagged so the
 *  UI can label them as related rather than exact. Any failure (no embedding
 *  provider, vector infra down) degrades to lexical-only — never a 500. */
async function semanticSupplement(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  try {
    const embedding = await resolveEmbedding(q);
    if (!embedding) return [];
    const rows = await db.execute(sql`
      SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
             v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
      FROM match_ingredients(${JSON.stringify(embedding)}::vector, ${limit}, ${SEMANTIC_VECTOR_THRESHOLD}) f
      JOIN vietnamese_food_composition v ON v.id = f.id
      ORDER BY f.similarity DESC, v.source_id ASC
    `);
    return (rows as unknown as Record<string, unknown>[]).map((row) => ({
      ...toSearchResult(row),
      semantic: true,
    }));
  } catch (error) {
    console.warn(
      '[ingredient-search] semantic supplement failed; lexical results only:',
      error
    );
    return [];
  }
}

async function searchIngredients(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  // Primary: trigram match via fuzzy_match_ingredients_all_sources — the same
  // ranking function the v2 AI matcher uses (branches diacritic vs ASCII
  // internally). It ranks with word_similarity — the query against the
  // best-matching extent of each name, with name_alt scored per variant — so
  // short queries like "ức gà" surface the long-named USDA body-part entries
  // instead of being drowned by short generic FAO names. The outer ORDER BY +
  // LIMIT collapse the per-source rows into one list: score first, curated FAO
  // (source_id 1) before translated USDA on ties, shorter names first; the
  // JOIN just adds per-100g macros.
  const fuzzyRows = await db.execute(sql`
    SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM fuzzy_match_ingredients_all_sources(${q}, ${limit}, 0.15) f
    JOIN vietnamese_food_composition v ON v.id = f.id
    ORDER BY f.similarity DESC, f.source_id ASC, length(f.name_primary) ASC
    LIMIT ${limit}
  `);
  const results = (fuzzyRows as unknown as Record<string, unknown>[]).map(
    toSearchResult
  );
  const seen = new Set(results.map((r) => r.id));

  // Semantic supplement: only when the lexical index has no strong answer —
  // a confident lexical hit means the user typed something the names cover,
  // and skipping the embedding path keeps the common case fast.
  const lexicalStrong =
    results.length > 0 && results[0].similarity >= LEXICAL_STRONG_SIMILARITY;
  if (!lexicalStrong) {
    for (const result of await semanticSupplement(q, limit)) {
      if (results.length >= limit) break;
      if (seen.has(result.id)) continue;
      seen.add(result.id);
      results.push(result);
    }
  }
  if (results.length >= limit) return results;

  // Supplement: trigram similarity is unreliable for short queries (Vietnamese
  // staples like "gà", "bò", "cá"), so backfill with a substring match against
  // the precomputed ASCII search text, prefix matches first.
  // The query is folded with the DB's own unaccent — the exact algorithm the
  // trigger used to generate search_text_ascii, so the two sides can't drift.
  const prefixRows = await db.execute(sql`
    SELECT v.id, v.name_primary, v.name_alt, v.name_en, v.state,
           0::float AS similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM vietnamese_food_composition v,
         lower(extensions.unaccent(${q})) AS ascii_q
    WHERE v.search_text_ascii LIKE '%' || ascii_q || '%'
    ORDER BY (v.search_text_ascii LIKE ascii_q || '%') DESC,
             v.source_id ASC,
             length(v.name_primary) ASC
    LIMIT ${limit}
  `);
  for (const row of prefixRows as unknown as Record<string, unknown>[]) {
    if (results.length >= limit) break;
    const result = toSearchResult(row);
    if (seen.has(result.id)) continue;
    seen.add(result.id);
    results.push(result);
  }
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuthAndProfile();
    const { q, limit } = ingredientSearchQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    // No AI-cost guards here: this is a cheap indexed query, throttled by auth,
    // the limit cap, and client-side debounce.
    const results = q
      ? await searchIngredients(q, limit)
      : await loadRecentIngredients(user.id, limit);

    return Response.json({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}
