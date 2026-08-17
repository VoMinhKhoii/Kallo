'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { buildUserContext } from '@/lib/ai/adapters/user-context';
import { logUnmatchedIngredients } from '@/lib/ai/matching/unmatched-log';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import { makeErrorResponse } from '@/lib/ai/pipeline/contracts/failure';
import {
  createGeminiClient,
  type GeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import type { PipelineResponse } from '@/lib/ai/types/result';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { createClient } from '@/lib/infra/supabase/server';

const rawInputSchema = z
  .string()
  .min(1, 'Meal description cannot be empty')
  .max(500, 'Meal description is too long');

/**
 * Server action: Analyze a meal description.
 *
 * Authenticates user, fetches profile, runs pipeline, logs unmatched ingredients.
 * Returns PipelineResponse (discriminated union: success | error).
 */
export async function analyzeMealAction(
  rawInput: string
): Promise<PipelineResponse> {
  const parsed = rawInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return makeErrorResponse(
      'non_food_input',
      parsed.error.issues[0]?.message ?? 'Invalid input.',
      false
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return makeErrorResponse(
        'api_error',
        'You must be logged in to analyze meals.',
        false
      );
    }

    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const profile = rows[0];
    if (!profile) {
      return makeErrorResponse(
        'api_error',
        'Profile not found. Please log in again.',
        false
      );
    }

    let gemini: GeminiClient;
    try {
      gemini = createGeminiClient(resolveGeminiProvider());
    } catch (error) {
      console.error('[analyzeMealAction] AI provider misconfigured:', error);
      return makeErrorResponse(
        'api_error',
        'AI service is not configured.',
        false
      );
    }
    const result = await analyzeMeal(
      parsed.data,
      buildUserContext(profile),
      db,
      gemini
    );

    // Log unmatched ingredients (fire and forget)
    if (result.success && result.data.unmatchedIngredients.length > 0) {
      logUnmatchedIngredients(
        result.data.unmatchedIngredients,
        null, // mealId not yet created — Phase 4 handles saving
        db,
        user.id
      ).catch((err) =>
        console.error('Failed to log unmatched ingredients:', err)
      );
    }

    return result;
  } catch (error) {
    console.error('analyzeMealAction error:', error);
    return makeErrorResponse(
      'api_error',
      'Something went wrong. Please try again.',
      true
    );
  }
}
