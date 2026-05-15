'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { createGeminiClient, resolveGeminiProvider } from './gemini';
import { buildUserContext } from './mappers';
import { logUnmatchedIngredients } from './matching';
import { analyzeMeal } from './pipeline';
import { makeErrorResponse } from './pipeline/errors';
import type { PipelineResponse } from './types';

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

    let gemini;
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
