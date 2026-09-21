'use server';

import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import { Errors } from '@/lib/core/errors/catalog';
import type {
  CheatSlidersPersisted,
  StagedCheatAnalysis,
} from '@/lib/core/types/cheat';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/core/validation/primitives';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { groupOccasions } from '@/lib/domain/cheat/occasion-grouping';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { meals } from '@/lib/infra/db/schema';
import type { RecentCheatOccasion } from '../types';
import { stageCheatSliders } from './stage-sliders';

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
}): Promise<StagedCheatAnalysis> {
  const parsed = stageCheatRepeatSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  // Premium: cheat meals are a Premium-card feature. Only the WRITE path is
  // gated — `loadRecentCheatOccasionsAction` above stays open so a free user
  // still sees their own history (and the chips that sell the upgrade).
  await assertFeatureAccess(
    { userId: user.id, profileCreatedAt: profile.createdAt },
    'cheat_meal'
  );

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

  // A re-log is a NEW eating event happening on the day I picked — unlike the
  // invite path, which re-opens a friend's occasion and keeps their instant.
  return stageCheatSliders(db, {
    userId: user.id,
    spec,
    levels,
    rawInput: source.rawInput,
    loggedAt: getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    ),
  });
}
