import { GoogleGenAI } from '@google/genai';
import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { type NextRequest, NextResponse } from 'next/server';
import { toJSONSchema } from 'zod';

import { createGeminiClient } from '@/lib/ai/gemini';
import { buildUserContext, toParsedMeal } from '@/lib/ai/mappers';
import {
  classifyConfidence,
  FUZZY_SIMILARITY_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from '@/lib/ai/matching';
import { fetchNutritionPer100g } from '@/lib/ai/matching/nutrition-db';
import { assembleResult } from '@/lib/ai/pipeline/assembly';
import { NON_FOOD_BLOCKLIST } from '@/lib/ai/pipeline/errors';
import {
  buildDecompositionPrompt,
  buildNutritionPrompt,
} from '@/lib/ai/prompts';
import {
  mealDecompositionSchema,
  nutritionAdjustmentSchema,
} from '@/lib/ai/schemas';
import type {
  MatchedIngredient,
  MealDecomposition,
  NutritionAdjustment,
  UnmatchedIngredient,
} from '@/lib/ai/types';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const untypedDb = db as unknown as PostgresJsDatabase;
const DEFAULT_USER_ID = '4681f168-e81b-4590-83ce-0f32734f19a9';

interface FuzzyMatchRow {
  id: string;
  name_primary: string;
  name_alt: string[] | null;
  name_en: string;
  state: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint disabled in production' },
      { status: 403 }
    );
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

  // Resolve user: auth > body.userId > default
  let userId: string = body.userId ?? DEFAULT_USER_ID;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  } catch {
    // No auth available — use provided or default userId
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not set' },
      { status: 500 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const gemini = createGeminiClient(apiKey);

  const trace: Record<string, any> = {
    input,
    userProfile: userContext,
  };

  // ── Step 1: Decomposition ──────────────────────────
  let decomposition: MealDecomposition | null = null;
  const s1Start = Date.now();
  const step1: Record<string, any> = {
    prompt: null,
    rawResponse: null,
    parsed: null,
    durationMs: 0,
    error: null,
  };

  try {
    const systemPrompt = buildDecompositionPrompt(userContext);
    step1.prompt = systemPrompt;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: input,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: toJSONSchema(mealDecompositionSchema),
      },
    });

    const rawText = response.text ?? null;
    step1.rawResponse = rawText;

    if (rawText) {
      decomposition = mealDecompositionSchema.parse(JSON.parse(rawText));
      step1.parsed = decomposition;

      if (!decomposition.isFood) {
        step1.error = 'LLM classified input as non-food (isFood=false)';
      }

      const blocked = decomposition.mealItems
        .flatMap((item) => item.ingredients.map((i) => i.name.toLowerCase()))
        .filter((n) => NON_FOOD_BLOCKLIST.has(n));

      if (blocked.length > 0) {
        step1.error = `Blocklisted terms found: ${blocked.join(', ')}`;
      }
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
          const q: Record<string, any> = {
            ingredientName: ingredient.name,
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
                ${ingredient.name}, 3, 0.15
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
                nutritionPer100g: nutrition ?? {},
              };
              q.matchStatus = confidence === 'low' ? 'low_confidence' : 'hit';

              if (nutrition) {
                matched.push({
                  ingredientName: ingredient.name,
                  foodCompositionId: top.id,
                  matchedName: top.name,
                  similarity: top.similarity,
                  confidence,
                  nutritionPer100g: nutrition,
                });
              } else {
                unmatched.push({
                  ingredientName: ingredient.name,
                  mealContext: mealItem.name,
                });
              }
            } else {
              // Vector fallback — fuzzy match absent or below threshold
              try {
                const embedding = await gemini.generateEmbedding(
                  ingredient.name
                );
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
                    nutritionPer100g: nutrition ?? {},
                  };
                  q.matchStatus =
                    confidence === 'low' ? 'low_confidence' : 'hit';

                  if (nutrition) {
                    matched.push({
                      ingredientName: ingredient.name,
                      foodCompositionId: top.id,
                      matchedName: top.name,
                      similarity: top.similarity,
                      confidence,
                      nutritionPer100g: nutrition,
                    });
                  } else {
                    unmatched.push({
                      ingredientName: ingredient.name,
                      mealContext: mealItem.name,
                    });
                  }
                } else {
                  unmatched.push({
                    ingredientName: ingredient.name,
                    mealContext: mealItem.name,
                  });
                }
              } catch (vectorErr) {
                console.error(
                  `[debug] Vector search failed for "${ingredient.name}":`,
                  vectorErr
                );
                unmatched.push({
                  ingredientName: ingredient.name,
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
              ingredientName: ingredient.name,
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
    durationMs: 0,
    error: null,
  };

  try {
    if (!decomposition || !decomposition.isFood) {
      step3.error = 'Skipped: no valid decomposition from step 1';
    } else {
      const systemPrompt = buildNutritionPrompt(
        decomposition.mealItems,
        matched,
        unmatched,
        userContext
      );
      step3.prompt = systemPrompt;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: input,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseJsonSchema: toJSONSchema(nutritionAdjustmentSchema),
        },
      });

      const rawText = response.text ?? null;
      step3.rawResponse = rawText;

      if (rawText) {
        nutritionAdj = nutritionAdjustmentSchema.parse(JSON.parse(rawText));
        step3.parsed = nutritionAdj;
      }
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
      const result = assembleResult(
        decomposition,
        nutritionAdj,
        matched,
        unmatched,
        userContext
      );
      step4.result = result;
      step4.confidenceOverall = result.confidenceOverall;
      step4.displayedNutrition = result.displayedNutrition;
    }
  } catch (err) {
    step4.error = err instanceof Error ? err.message : String(err);
  }

  step4.durationMs = Date.now() - s4Start;
  trace.step4_assembly = step4;

  trace.totalDurationMs = Date.now() - totalStart;

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
