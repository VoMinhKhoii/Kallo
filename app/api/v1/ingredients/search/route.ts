import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import {
  cacheQueryEmbedding,
  resolveQueryEmbedding,
} from '@/lib/ai/cache/embedding-cache';
import {
  createGeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import { ingredientSearchQuerySchema } from '@/lib/api/contracts/ingredients';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth/session';
import { db } from '@/lib/db';
import type { IngredientSearchResult } from '@/lib/logging/manual-logging';

export const runtime = 'nodejs';

// Vector matches below this cosine similarity are noise for a picker UI.
const SEMANTIC_VECTOR_THRESHOLD = 0.72;
// Reciprocal Rank Fusion dampening constant (Cormack et al.).
const RRF_K = 60;
// The semantic arm is weighted heavier than the lexical arm in the fusion.
// Trigram word_similarity SATURATES — many rows tie at ~1.0 because they share
// a token with the query — and it has no way to tell a polysemous token apart:
// "cơm" alone is rice, but "cá cơm" is anchovy and "rau giền cơm" is amaranth;
// "ức gà" is chicken breast, "ức gà tây" is turkey. Embeddings disambiguate
// these by meaning, so they get the louder vote; cross-arm agreement does the
// rest (a row both arms return outranks a lexical-only token collision).
const SEMANTIC_RRF_WEIGHT = 2;
// Don't embed 1-character queries — the vector is noise at that length.
const MIN_SEMANTIC_QUERY_LENGTH = 2;

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

/** Lexical (trigram) arm: fuzzy_match_ingredients_all_sources — the same
 *  word_similarity ranking the v2 AI matcher uses. Per-source rows collapse
 *  into one list: score first, curated FAO (source_id 1) before translated
 *  USDA on ties, shorter names first; the JOIN adds per-100g macros. */
async function lexicalSearch(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  const rows = await db.execute(sql`
    SELECT f.id, f.name_primary, f.name_alt, f.name_en, f.state, f.similarity,
           v.calories_kcal, v.protein_g, v.carbohydrate_g, v.fat_g
    FROM fuzzy_match_ingredients_all_sources(${q}, ${limit}, 0.15) f
    JOIN vietnamese_food_composition v ON v.id = f.id
    WHERE f.similarity >= 0.15
    ORDER BY f.similarity DESC, f.source_id ASC, length(f.name_primary) ASC
    LIMIT ${limit}
  `);
  return (rows as unknown as Record<string, unknown>[]).map(toSearchResult);
}

/**
 * Fuse the lexical and semantic arms by weighted Reciprocal Rank Fusion: a
 * result is scored by Σ weight/(RRF_K + rank) across the arms it appears in.
 * Cosine and trigram scores are not on comparable scales, so we fuse by RANK,
 * not raw score — and the semantic arm carries SEMANTIC_RRF_WEIGHT because
 * trigram ranking saturates and can't disambiguate polysemous tokens. A row
 * both arms return wins on agreement; a row only the embedding arm found keeps
 * its `semantic: true` flag (the "≈ related" badge); a row only the lexical arm
 * found keeps its exact variant.
 */
function rrfFuse(
  lexical: IngredientSearchResult[],
  semantic: IngredientSearchResult[],
  limit: number
): IngredientSearchResult[] {
  const fused = new Map<
    string,
    {
      score: number;
      inLexical: boolean;
      inSemantic: boolean;
      result: IngredientSearchResult;
    }
  >();
  lexical.forEach((result, rank) => {
    fused.set(result.id, {
      score: 1 / (RRF_K + rank),
      inLexical: true,
      inSemantic: false,
      result,
    });
  });
  semantic.forEach((result, rank) => {
    const contribution = SEMANTIC_RRF_WEIGHT / (RRF_K + rank);
    const existing = fused.get(result.id);
    if (existing) {
      existing.score += contribution;
      existing.inSemantic = true; // keep the lexical (exact, unflagged) variant
    } else {
      fused.set(result.id, {
        score: contribution,
        inLexical: false,
        inSemantic: true,
        result,
      });
    }
  });
  // Tie-break: cross-arm agreement first, then semantic presence (the more
  // trustworthy signal here) — never the raw, cross-metric `similarity`.
  const agreement = (e: { inLexical: boolean; inSemantic: boolean }) =>
    e.inLexical && e.inSemantic ? 2 : e.inSemantic ? 1 : 0;
  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score || agreement(b) - agreement(a))
    .slice(0, limit)
    .map((entry) => entry.result);
}

async function searchIngredients(
  q: string,
  limit: number
): Promise<IngredientSearchResult[]> {
  // Always run both arms (in parallel) and rank-fuse. A high lexical score is
  // NOT trustworthy on its own — word_similarity saturates, tying many rows
  // that merely share a token with the query — so we never let it suppress the
  // embedding arm. Embeddings degrade to [] on failure (and are skipped for
  // 1-char queries), so the worst case is plain lexical ranking.
  const [lexical, semantic] = await Promise.all([
    lexicalSearch(q, limit),
    q.length >= MIN_SEMANTIC_QUERY_LENGTH
      ? semanticSupplement(q, limit)
      : Promise.resolve<IngredientSearchResult[]>([]),
  ]);
  const results =
    semantic.length > 0 ? rrfFuse(lexical, semantic, limit) : lexical;
  if (results.length >= limit) return results;

  const seen = new Set(results.map((r) => r.id));
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
