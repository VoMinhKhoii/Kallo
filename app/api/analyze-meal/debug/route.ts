import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin/is-admin';
import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import { buildUserContext } from '@/lib/ai/adapters/user-context';
import { getMemoryCacheStats } from '@/lib/ai/cache/embedding-cache';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import { getDecompositionPromptLabel } from '@/lib/ai/prompts/build/decomposition';
import { getNutritionPromptLabel } from '@/lib/ai/prompts/build/nutrition';
import { getProviderJsonSchemaMode } from '@/lib/ai/prompts/schema';
import {
  createGeminiClient,
  type GeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

import { runDbLookupDebugStep } from './step-db-lookup';
import { runDecompositionDebugStep } from './step-decomposition';
import {
  runAssemblyDebugStep,
  runNutritionDebugStep,
} from './step-nutrition-assembly';

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
  const { step1, decomposition } = await runDecompositionDebugStep({
    gemini,
    modelProfile,
    userContext,
    input,
  });
  trace.step1_decomposition = step1;

  // ── Step 2: DB Lookup ──────────────────────────────
  const { step2, matched, unmatched } = await runDbLookupDebugStep({
    gemini,
    decomposition,
  });
  trace.step2_dbLookup = step2;

  // ── Step 3: Nutrition Adjustment ───────────────────
  const { step3, nutritionAdj } = await runNutritionDebugStep({
    gemini,
    modelProfile,
    userContext,
    decomposition,
    matched,
    unmatched,
  });
  trace.step3_adjustment = step3;

  // ── Step 4: Assembly ───────────────────────────────
  const step4 = runAssemblyDebugStep({
    decomposition,
    nutritionAdj,
    matched,
    unmatched,
    userContext,
  });
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
