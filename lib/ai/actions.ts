'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { createGeminiClient } from './gemini';
import { buildUserContext } from './mappers';
import { logUnmatchedIngredients } from './matching';
import { analyzeMeal } from './pipeline';
import type { PipelineResponse } from './types';

const rawInputSchema = z
  .string()
  .min(1, 'Meal description cannot be empty')
  .max(500, 'Meal description is too long');

function errorResponse(
  type: 'non_food_input' | 'parse_error' | 'api_error',
  message: string,
  retryable: boolean
): PipelineResponse {
  return { success: false, error: { type, message, retryable } };
}

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
    return errorResponse(
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
      return errorResponse(
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
    if (!profile?.goal || !profile?.regionalProfile) {
      return errorResponse(
        'api_error',
        'Please complete onboarding before analyzing meals.',
        false
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse('api_error', 'AI service is not configured.', false);
    }

    const gemini = createGeminiClient(apiKey);
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
        db
      ).catch((err) =>
        console.error('Failed to log unmatched ingredients:', err)
      );
    }

    return result;
  } catch (error) {
    console.error('analyzeMealAction error:', error);
    return errorResponse(
      'api_error',
      'Something went wrong. Please try again.',
      true
    );
  }
}
