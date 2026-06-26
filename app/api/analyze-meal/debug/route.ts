import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin/is-admin';
import {
  createGeminiClient,
  type GeminiAttemptMetadata,
  type GeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/gemini';
import { buildUserContext, toParsedMeal } from '@/lib/ai/mappers';
import {
  classifyConfidence,
  FUZZY_SIMILARITY_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from '@/lib/ai/matching';
import {
  cacheQueryEmbedding,
  getMemoryCacheStats,
  normalizeIngredientKey,
  resolveQueryEmbedding,
} from '@/lib/ai/matching/embedding-cache';
import { fetchNutritionPer100g } from '@/lib/ai/matching/nutrition-db';
import { assembleResult } from '@/lib/ai/pipeline/assembly';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { NON_FOOD_BLOCKLIST } from '@/lib/ai/pipeline/errors';
import { ensureIdsOnDecomposition } from '@/lib/ai/pipeline/ids';
import {
  ingredientDisplayName,
  ingredientCanonicalName as ingredientSearchName,
} from '@/lib/ai/pipeline/ingredient-accessors';
import { reconcileNutritionIds } from '@/lib/ai/pipeline/nutrition';
import {
  mealDecompositionSchema,
  nutritionAdjustmentSchema,
} from '@/lib/ai/pipeline/schemas';
import {
  getDecompositionPromptBuilder,
  getDecompositionPromptLabel,
  getNutritionPromptBuilder,
  getNutritionPromptLabel,
} from '@/lib/ai/prompts';
import { getProviderJsonSchemaMode } from '@/lib/ai/prompts/schema';
import type {
  MatchedIngredient,
  NutritionAdjustment,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import { db } from '@/lib/db';
import type * as schema from '@/lib/db/schema';
import { userProfiles } from '@/lib/db/schema';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { createClient } from '@/lib/supabase/server';

const untypedDb = db as unknown as PostgresJsDatabase<typeof schema>;
const DEBUG_LLM_TIMEOUT_MS = 25_000;

/** Extract only the big 4 macros from a nutrition object for debug readability */
function pickMacros(obj: any) {
  if (!obj) return obj;
  return {
    caloriesKcal: obj.caloriesKcal ?? null,
    proteinG: obj.proteinG ?? null,
    carbohydrateG: obj.carbohydrateG ?? null,
    fatG: obj.fatG ?? null,
  };
}

function serializeAttempt(metadata: GeminiAttemptMetadata) {
  return {
    attempt: metadata.attempt,
    model: metadata.model,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    error:
      metadata.error instanceof Error
        ? metadata.error.message
        : metadata.error != null
          ? String(metadata.error)
          : null,
  };
}

interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  // Hard admin gate. The route runs the live pipeline against arbitrary input
  // and burns Gemini tokens, so it must require an authenticated admin in
  // every environment — not just non-production.
  let userId: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase();
    if (!user || !isAdminEmail(email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const totalStart = Date.now();

  const body = await request.json();
  const input: string = body.input;

  if (!input || typeof input !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid "input" field' },
      { status: 400 }
    );
  }

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json(
      { error: `No profile found for userId: ${userId}` },
      { status: 404 }
    );
  }

  const userContext = buildUserContext(profile);

  let gemini: GeminiClient;
  try {
    gemini = createGeminiClient(resolveGeminiProvider());
  } catch (error) {
    return NextResponse.json(
      {
        error: `AI provider misconfigured: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
  const modelProfile = resolveModelProfile();
  const decompositionPromptLabel = getDecompositionPromptLabel();
  const nutritionPromptLabel = getNutritionPromptLabel();
  const providerSchemaMode = getProviderJsonSchemaMode();

  const trace: Record<string, any> = {
    input,
    userProfile: userContext,
    pipelineConfig: {
      decompositionModel: modelProfile.decompositionModel,
      nutritionModel: modelProfile.nutritionModel,
      escalationModel: modelProfile.escalationModel,
      decompositionPromptLabel,
      nutritionPromptLabel,
      providerSchemaMode,
    },
  };

  // ── Step 1: Decomposition ──────────────────────────
  let decomposition: ReturnType<typeof ensureIdsOnDecomposition> | null = null;
  const s1Start = Date.now();
  const step1: Record<string, any> = {
    prompt: null,
    rawResponse: null,
    parsed: null,
    attempts: [],
    durationMs: 0,
    error: null,
  };

  try {
    const decompositionPromptBuilder = getDecompositionPromptBuilder();
    const systemPrompt = decompositionPromptBuilder(userContext);
    step1.prompt = systemPrompt;

    let rawResponse = '';
    const parsed = await fetchWithTimeout(
      (signal) =>
        gemini.generateStructuredOutputStream(
          {
            schema: mealDecompositionSchema,
            systemPrompt,
            userMessage: input,
            model: modelProfile.decompositionModel,
            temperature: 0.3,
            topP: 1,
            topK: 1,
            abortSignal: signal,
          },
          {
            onChunk: (accumulated) => {
              rawResponse = accumulated;
            },
            onAttemptComplete: (metadata) => {
              step1.attempts.push(serializeAttempt(metadata));
            },
          }
        ),
      DEBUG_LLM_TIMEOUT_MS,
      'debug-decomposition'
    );
    step1.rawResponse = rawResponse;
    decomposition = ensureIdsOnDecomposition(parsed);
    step1.parsed = decomposition;

    if (!decomposition.isFood) {
      step1.error = 'LLM classified input as non-food (isFood=false)';
    }

    const blocked = decomposition.mealItems
      .flatMap((item) =>
        item.ingredients.map((i) => ingredientDisplayName(i).toLowerCase())
      )
      .filter((n) => NON_FOOD_BLOCKLIST.has(n));

    if (blocked.length > 0) {
      step1.error = `Blocklisted terms found: ${blocked.join(', ')}`;
    }
  } catch (err) {
    step1.error = err instanceof Error ? err.message : String(err);
  }

  step1.durationMs = Date.now() - s1Start;
  trace.step1_decomposition = step1;

  // ── Step 2: DB Lookup ──────────────────────────────
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
  trace.step2_dbLookup = step2;

  // ── Step 3: Nutrition Adjustment ───────────────────
  let nutritionAdj: NutritionAdjustment | null = null;
  const s3Start = Date.now();
  const step3: Record<string, any> = {
    prompt: null,
    rawResponse: null,
    parsed: null,
    attempts: [],
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !decomposition.isFood) {
      step3.error = 'Skipped: no valid decomposition from step 1';
    } else {
      const nutritionPromptBuilder = getNutritionPromptBuilder();
      const systemPrompt = nutritionPromptBuilder(
        decomposition.mealItems,
        matched,
        unmatched,
        userContext
      );
      step3.prompt = systemPrompt;

      let rawResponse = '';
      const parsed = await fetchWithTimeout(
        (signal) =>
          gemini.generateStructuredOutputStream(
            {
              schema: nutritionAdjustmentSchema,
              systemPrompt,
              userMessage:
                'Produce bounded nutrition estimates for each ingredient in each meal item based on the reference data provided.',
              model: modelProfile.nutritionModel,
              temperature: 0.5,
              topP: 1,
              topK: 1,
              abortSignal: signal,
            },
            {
              onChunk: (accumulated) => {
                rawResponse = accumulated;
              },
              onAttemptComplete: (metadata) => {
                step3.attempts.push(serializeAttempt(metadata));
              },
            }
          ),
        DEBUG_LLM_TIMEOUT_MS,
        'debug-nutrition'
      );

      step3.rawResponse = rawResponse;
      nutritionAdj = reconcileNutritionIds(parsed, decomposition, matched);
      step3.parsed = nutritionAdj;
    }
  } catch (err) {
    step3.error = err instanceof Error ? err.message : String(err);
  }

  step3.durationMs = Date.now() - s3Start;
  trace.step3_adjustment = step3;

  // ── Step 4: Assembly ───────────────────────────────
  const s4Start = Date.now();
  const step4: Record<string, any> = {
    result: null,
    confidenceOverall: null,
    displayedNutrition: null,
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !nutritionAdj) {
      step4.error = 'Skipped: missing decomposition or nutrition';
    } else {
      const { result } = assembleResult(
        decomposition,
        nutritionAdj,
        matched,
        unmatched,
        userContext
      );
      // Trim nutrition to big 4 for debug readability
      step4.result = {
        ...result,
        boundedNutrition: pickMacros(result.boundedNutrition),
        displayedNutrition: pickMacros(result.displayedNutrition),
        mealItems: result.mealItems.map((mi) => ({
          ...mi,
          boundedNutrition: pickMacros(mi.boundedNutrition),
          displayedNutrition: pickMacros(mi.displayedNutrition),
          ingredients: mi.ingredients.map((ing) => ({
            ...ing,
            boundedNutrition: pickMacros(ing.boundedNutrition),
            displayedNutrition: pickMacros(ing.displayedNutrition),
          })),
        })),
      };
      step4.confidenceOverall = result.confidenceOverall;
      step4.displayedNutrition = pickMacros(result.displayedNutrition);
    }
  } catch (err) {
    step4.error = err instanceof Error ? err.message : String(err);
  }

  step4.durationMs = Date.now() - s4Start;
  trace.step4_assembly = step4;

  trace.totalDurationMs = Date.now() - totalStart;
  trace.embeddingCacheStats = getMemoryCacheStats();

  // Null nutrition guard check (mirrors route.ts)
  if (step4.result) {
    const meal = toParsedMeal(step4.result);
    const hasNutrition = meal.items?.some(
      (item) => item.macros.calories !== 0 || item.macros.protein !== 0
    );
    trace.nullNutritionGuard = {
      parsedMeal: meal,
      hasNutrition,
      wouldReturn500: !hasNutrition,
    };
  }

  return NextResponse.json(trace);
}
