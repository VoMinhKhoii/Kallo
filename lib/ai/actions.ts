'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { createGeminiClient } from './gemini';
import { logUnmatchedIngredients } from './ingredient-matching';
import { analyzeMeal } from './pipeline';
import type { PipelineResponse, UserContext } from './types';

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
    return {
      success: false,
      error: {
        type: 'non_food_input',
        message: parsed.error.issues[0]?.message ?? 'Invalid input.',
        retryable: false,
      },
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: 'You must be logged in to analyze meals.',
          retryable: false,
        },
      };
    }

    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const profile = rows[0];
    if (!profile?.goal || !profile?.regionalProfile) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: 'Please complete onboarding before analyzing meals.',
          retryable: false,
        },
      };
    }

    const userContext: UserContext = {
      goal: profile.goal as UserContext['goal'],
      aggression: profile.aggression ? Number(profile.aggression) : 0,
      regionalProfile:
        profile.regionalProfile as UserContext['regionalProfile'],
      cookingHabits: {
        oilUsage:
          (profile.oilUsage as UserContext['cookingHabits']['oilUsage']) ??
          'normal',
        defaultRicePortion:
          (profile.defaultRicePortion as UserContext['cookingHabits']['defaultRicePortion']) ??
          'medium',
        sugarBraised:
          (profile.sugarBraised as UserContext['cookingHabits']['sugarBraised']) ??
          'medium',
        defaultProteinPortion:
          (profile.defaultProteinPortion as UserContext['cookingHabits']['defaultProteinPortion']) ??
          'medium',
        brothConsumption:
          (profile.brothConsumption as UserContext['cookingHabits']['brothConsumption']) ??
          'some',
      },
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: {
          type: 'api_error',
          message: 'AI service is not configured.',
          retryable: false,
        },
      };
    }

    const gemini = createGeminiClient(apiKey);
    const result = await analyzeMeal(parsed.data, userContext, db, gemini);

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
    return {
      success: false,
      error: {
        type: 'api_error',
        message: 'Something went wrong. Please try again.',
        retryable: true,
      },
    };
  }
}
