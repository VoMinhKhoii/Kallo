import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { GeminiClient } from '@/lib/ai/gemini';
import {
  classifyConfidence,
  FUZZY_SIMILARITY_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from '@/lib/ai/matching';
import {
  cacheQueryEmbedding,
  normalizeIngredientKey,
  resolveQueryEmbedding,
} from '@/lib/ai/matching/embedding-cache';
import { fetchNutritionPer100g } from '@/lib/ai/matching/nutrition-db';
import type { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/ids';
import {
  ingredientDisplayName,
  ingredientCanonicalName as ingredientSearchName,
} from '@/lib/ai/pipeline/ingredient-accessors';
import type { MatchedIngredient, UnmatchedIngredient } from '@/lib/ai/types';
import { db } from '@/lib/db';
import type * as schema from '@/lib/db/schema';

import { type FuzzyMatchRow, pickMacros } from './debug-shared';

const untypedDb = db as unknown as PostgresJsDatabase<typeof schema>;

/** Step 2: fuzzy→vector DB lookup per ingredient, with per-query traces. */
export async function runDbLookupDebugStep({
  gemini,
  decomposition,
}: {
  gemini: GeminiClient;
  decomposition: ReturnType<typeof ensureIdsOnDecomposition> | null;
}) {
  const matched: MatchedIngredient[] = [];
  const unmatched: UnmatchedIngredient[] = [];
  const s2Start = Date.now();
  const step2: Record<string, any> = {
    queries: [],
    matched: [],
    unmatched: [],
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !decomposition.isFood) {
      step2.error = 'Skipped: no valid decomposition from step 1';
    } else {
      const queries: Record<string, any>[] = [];

      for (const mealItem of decomposition.mealItems) {
        for (const ingredient of mealItem.ingredients) {
          const searchName = ingredientSearchName(ingredient);
          const displayName = ingredientDisplayName(ingredient);
          const q: Record<string, any> = {
            ingredientName: displayName,
            canonicalName: searchName,
            searchMethod: 'none' as const,
            fuzzyMatches: [],
            vectorMatches: [],
            selectedMatch: null,
            matchStatus: 'miss' as const,
          };

          try {
            // Fuzzy search
            const fuzzyRows = (await db.execute(
              sql`SELECT * FROM fuzzy_match_ingredients(
                ${searchName}, 3, 0.15
              )`
            )) as unknown as FuzzyMatchRow[];

            const fuzzyMatches = fuzzyRows.map((r) => ({
              id: r.id,
              name: r.name_primary,
              similarity: r.similarity,
            }));
            q.fuzzyMatches = fuzzyMatches;

            const fuzzyTop = fuzzyMatches[0];
            const fuzzyAccepted =
              fuzzyTop && fuzzyTop.similarity >= FUZZY_SIMILARITY_THRESHOLD;

            if (fuzzyAccepted) {
              q.searchMethod = 'fuzzy';
              const top = fuzzyTop;
              const confidence = classifyConfidence(top.similarity);
              const nutrition = await fetchNutritionPer100g(top.id, untypedDb);

              q.selectedMatch = {
                id: top.id,
                name: top.name,
                similarity: top.similarity,
                confidence,
                nutritionPer100g: pickMacros(nutrition),
                dbState: 'raw',
              };
              q.matchStatus = confidence === 'low' ? 'low_confidence' : 'hit';

              if (nutrition) {
                matched.push({
                  ingredientName: displayName,
                  ingredientId: ingredient.ingredientId,
                  foodCompositionId: top.id,
                  matchedName: top.name,
                  similarity: top.similarity,
                  confidence,
                  nutritionPer100g: nutrition,
                  dbState: 'raw',
                });
              } else {
                unmatched.push({
                  ingredientName: displayName,
                  mealContext: mealItem.name,
                });
              }
            } else {
              // Vector fallback — fuzzy match absent or below threshold
              try {
                // Use embedding cache (same as production pipeline)
                let embedding = await resolveQueryEmbedding(
                  searchName,
                  untypedDb
                );
                let embeddingSource: 'cache' | 'gemini_api' = 'cache';

                if (!embedding) {
                  embedding = await gemini.generateEmbedding(searchName);
                  cacheQueryEmbedding(searchName, embedding, untypedDb);
                  embeddingSource = 'gemini_api';
                }

                q.embeddingCache = {
                  normalizedKey: normalizeIngredientKey(searchName),
                  source: embeddingSource,
                };
                const vectorRows = (await db.execute(
                  sql`SELECT * FROM match_ingredients(
                    ${JSON.stringify(embedding)}::vector,
                    3, 0.5
                  )`
                )) as unknown as FuzzyMatchRow[];

                const vectorMatches = vectorRows.map((r) => ({
                  id: r.id,
                  name: r.name_primary,
                  similarity: r.similarity,
                }));
                q.vectorMatches = vectorMatches;

                const vectorTop = vectorMatches[0];
                const vectorAccepted =
                  vectorTop &&
                  vectorTop.similarity >= VECTOR_SIMILARITY_THRESHOLD;

                if (vectorAccepted) {
                  q.searchMethod = 'vector';
                  const top = vectorTop;
                  const confidence = classifyConfidence(top.similarity);
                  const nutrition = await fetchNutritionPer100g(
                    top.id,
                    untypedDb
                  );

                  q.selectedMatch = {
                    id: top.id,
                    name: top.name,
                    similarity: top.similarity,
                    confidence,
                    nutritionPer100g: pickMacros(nutrition),
                    dbState: 'raw',
                  };
                  q.matchStatus =
                    confidence === 'low' ? 'low_confidence' : 'hit';

                  if (nutrition) {
                    matched.push({
                      ingredientName: displayName,
                      ingredientId: ingredient.ingredientId,
                      foodCompositionId: top.id,
                      matchedName: top.name,
                      similarity: top.similarity,
                      confidence,
                      nutritionPer100g: nutrition,
                      dbState: 'raw',
                    });
                  } else {
                    unmatched.push({
                      ingredientName: displayName,
                      mealContext: mealItem.name,
                    });
                  }
                } else {
                  unmatched.push({
                    ingredientName: displayName,
                    mealContext: mealItem.name,
                  });
                }
              } catch (vectorErr) {
                console.error(
                  `[debug] Vector search failed for "${searchName}":`,
                  vectorErr
                );
                unmatched.push({
                  ingredientName: displayName,
                  mealContext: mealItem.name,
                });
              }
            }
          } catch (ingredientErr) {
            q.matchStatus = 'miss';
            q.error =
              ingredientErr instanceof Error
                ? ingredientErr.message
                : String(ingredientErr);
            unmatched.push({
              ingredientName: displayName,
              mealContext: mealItem.name,
            });
          }

          queries.push(q);
        }
      }

      step2.queries = queries;
      step2.matched = matched;
      step2.unmatched = unmatched;
    }
  } catch (err) {
    step2.error = err instanceof Error ? err.message : String(err);
  }

  step2.durationMs = Date.now() - s2Start;
  return { step2, matched, unmatched };
}
