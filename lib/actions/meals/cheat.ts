'use server';

import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import type {
  CheatSliderSpec,
  CheatSlidersPersisted,
} from '@/lib/core/types/cheat';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { groupOccasions } from '@/lib/domain/cheat/occasion-grouping';
import { withLevelsAsDefaults } from '@/lib/domain/cheat/slider-nutrition';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';
import type { RecentCheatOccasion } from './types';

// ---------------------------------------------------------------------------
// Repeat a previous cheat occasion (no AI call)
// ---------------------------------------------------------------------------

const loadRecentCheatOccasionsSchema = z.object({
  limit: z.number().int().min(1).max(12).optional(),
});

/**
 * Recent, de-duplicated cheat occasions for the current user — the source for
 * the "log it again" chips. Dedup is by occasion text (most recent kept) so a
 * place the user cheats at often shows up once, not five times.
 */
export async function loadRecentCheatOccasionsAction(input: {
  limit?: number;
}): Promise<RecentCheatOccasion[]> {
  const parsed = loadRecentCheatOccasionsSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  const limit = parsed.limit ?? 5;

  const rows = await db
    .select({
      id: meals.id,
      rawInput: meals.rawInput,
      loggedAt: meals.loggedAt,
    })
    .from(meals)
    .where(and(eq(meals.userId, user.id), eq(meals.entryMode, 'cheat')))
    .orderBy(desc(meals.loggedAt))
    .limit(60);

  // Group near-duplicate occasions (e.g. "korean bbq" / "Korean BBQ buffet")
  // so a place the user cheats at often shows up once, keeping its newest wording.
  return groupOccasions(rows, limit).map((row) => ({
    mealId: row.id,
    rawInput: row.rawInput,
    loggedAt: row.loggedAt.toISOString(),
  }));
}

const stageCheatRepeatSchema = z.object({
  sourceMealId: z.string().uuid('sourceMealId phải là UUID hợp lệ.'),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * Repeat a past cheat occasion without re-running the estimator: re-stage its
 * stored slider spec as a fresh pending analysis, with each slider's default
 * pre-set to last time's chosen level (the user can still nudge — this time's
 * amounts may differ). Confirm then flows through the normal cheat path.
 */
export async function stageCheatRepeatAction(input: {
  sourceMealId: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<{
  analysisId: string;
  spec: CheatSliderSpec;
  rawInput: string;
  loggedAt: string;
}> {
  const parsed = stageCheatRepeatSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  const [source] = await db
    .select({
      rawInput: meals.rawInput,
      cheatSliders: meals.cheatSliders,
      entryMode: meals.entryMode,
    })
    .from(meals)
    .where(and(eq(meals.id, parsed.sourceMealId), eq(meals.userId, user.id)))
    .limit(1);

  if (!source || source.entryMode !== 'cheat' || !source.cheatSliders) {
    throw Errors.validationFailed('Không tìm thấy bữa xả trước đó.');
  }

  const { spec, levels } = source.cheatSliders as CheatSlidersPersisted;
  const repeatSpec = withLevelsAsDefaults(spec, levels);

  const loggedAt = getUtcInstantForLocalDate(
    parsed.loggedDate,
    parsed.timezoneOffset
  );

  const [inserted] = await db
    .insert(pendingAnalyses)
    .values({
      userId: user.id,
      pipelineResult: { entryMode: 'cheat', spec: repeatSpec },
      rawInput: source.rawInput,
      entryMode: 'cheat',
      loggedAt,
    })
    .returning({ id: pendingAnalyses.id });

  return {
    analysisId: inserted.id,
    spec: repeatSpec,
    rawInput: source.rawInput,
    loggedAt: loggedAt.toISOString(),
  };
}
