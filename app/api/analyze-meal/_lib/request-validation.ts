import { eq } from 'drizzle-orm';
import type { NextRequest, NextResponse } from 'next/server';
import {
  type GeminiProviderConfig,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';
import { mealMessageSchema } from '@/lib/core/validation/meal';
import { db } from '@/lib/infra/db';
import { userProfiles } from '@/lib/infra/db/schema';
import type { AnalysisGuardAllowedResult } from '@/lib/infra/rate-limit/analysis-guard-types';
import { createClient } from '@/lib/infra/supabase/server';

export function createGuardRelease(
  release: AnalysisGuardAllowedResult['release']
) {
  let releasePromise: Promise<void> | undefined;

  return () => {
    if (!release) return Promise.resolve();

    releasePromise ??= (async () => {
      try {
        await release();
      } catch (error) {
        console.error(
          '[analyze-meal] Failed to release analysis guard:',
          error
        );
      }
    })();

    return releasePromise;
  };
}

type GeminiConfigResult =
  | { ok: true; config: GeminiProviderConfig }
  | { ok: false; error: NextResponse };

export function resolveGeminiConfig(): GeminiConfigResult {
  try {
    return { ok: true, config: resolveGeminiProvider() };
  } catch (error) {
    console.error('[analyze-meal] AI provider misconfigured:', error);
    return { ok: false, error: serializeError(Errors.internal()) };
  }
}

/**
 * Pre-stream validation: auth, input, and profile.
 * Returns structured JSON error responses before SSE starts.
 *
 * Auth verification and body parsing run in parallel to reduce latency by
 * ~50-100ms on each request (saves one sequential network round-trip).
 */
export async function validateRequest(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Parallelize auth and body parsing — independent operations
    const [authResult, bodyResult] = await Promise.allSettled([
      supabase.auth.getUser(),
      request.json() as Promise<unknown>,
    ]);

    // Validate auth — getUser() can resolve with { data: { user: null }, error: AuthError }
    if (
      authResult.status === 'rejected' ||
      authResult.value.error ||
      !authResult.value.data.user
    ) {
      throw Errors.notAuthenticated();
    }
    const user = authResult.value.data.user;

    // Validate body parse
    if (bodyResult.status === 'rejected') {
      throw Errors.validationFailed('Invalid JSON in request body');
    }
    const body = bodyResult.value;

    // Fetch profile (requires user.id from auth above)
    const rows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    const profile = rows[0];
    if (!profile) {
      throw Errors.profileNotFound();
    }

    const parsed = mealMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw Errors.validationFailed(
        parsed.error.issues[0]?.message ?? 'Invalid input'
      );
    }

    return {
      data: {
        userId: user.id,
        message: parsed.data.message,
        locale: parsed.data.locale,
        // A refine inherits the original meal's instant so the corrected meal
        // keeps its timeline position/slot; a fresh log stamps from the day.
        loggedAt: parsed.data.inheritLoggedAt
          ? new Date(parsed.data.inheritLoggedAt)
          : getUtcInstantForLocalDate(
              parsed.data.loggedDate,
              parsed.data.timezoneOffset
            ),
        mode: parsed.data.mode ?? 'precise',
        cheatType: parsed.data.cheatType,
        clarifyAnswer: parsed.data.clarifyAnswer,
        cheatIntensity: parsed.data.cheatIntensity,
        attemptId: parsed.data.attemptId,
        // Combined relog picks (precise mode only). Resolved + merged after the
        // pipeline runs on `message` alone — never fed into the AI.
        refs: parsed.data.refs,
        profile,
      },
    };
  } catch (error) {
    return { error: serializeError(error) };
  }
}
