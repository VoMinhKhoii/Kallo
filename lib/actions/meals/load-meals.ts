'use server';

import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
} from '@/lib/actions/persisted-meal';
import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import type { PipelineResult } from '@/lib/ai/types/result';
import { requireAuthAndProfile } from '@/lib/auth/session';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, mealShares, meals, pendingAnalyses } from '@/lib/db/schema';
import type { CheatSliderSpec, CheatSlidersPersisted } from '@/lib/types/cheat';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/validation/primitives';
import type {
  LoggingDayData,
  PendingMealConfirmation,
  PersistedMeal,
} from './types';

const loadMealsByDateSchema = z.object({
  date: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});
type LoadMealsByDateInput = z.infer<typeof loadMealsByDateSchema>;
const loadMealDatesSchema = z.object({
  timezoneOffset: timezoneOffsetSchema,
});

// ---------------------------------------------------------------------------
// C2: Load Meals by Date
// ---------------------------------------------------------------------------

export async function loadMealsByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PersistedMeal[]> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return loadMealsByDateForUser(user.id, parsed);
}

async function loadMealsByDateForUser(
  userId: string,
  parsed: LoadMealsByDateInput
): Promise<PersistedMeal[]> {
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  // Fetch meals in date range
  const mealRows = await db
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, dayStart),
        lt(meals.loggedAt, dayEnd)
      )
    )
    .orderBy(desc(meals.loggedAt));

  if (mealRows.length === 0) return [];

  // Fetch all meal items for these meals in one query
  const mealIds = mealRows.map((m) => m.id);
  const itemRows = await db
    .select()
    .from(mealItems)
    .where(inArray(mealItems.mealId, mealIds));

  // Group items by mealId
  const itemsByMealId = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const existing = itemsByMealId.get(item.mealId) ?? [];
    existing.push(item);
    itemsByMealId.set(item.mealId, existing);
  }

  // Fetch each meal's share row (at most one per meal) so the card can seed its
  // share toggle from real state instead of defaulting to "not shared".
  const shareRows = await db
    .select({
      mealId: mealShares.mealId,
      id: mealShares.id,
      visibility: mealShares.visibility,
    })
    .from(mealShares)
    .where(inArray(mealShares.mealId, mealIds));
  const shareByMealId = new Map(shareRows.map((s) => [s.mealId, s]));

  return mealRows.map((meal) => {
    const items = itemsByMealId.get(meal.id) ?? [];

    const mealItemGroups = buildMealItemGroupsFromRows(
      items.map((item) => ({
        ...item,
        nutrition: extractNutritionValues(item),
      }))
    );

    const share = shareByMealId.get(meal.id);

    return buildPersistedMeal({
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      nutrition: extractNutritionValues(meal),
      mealItemGroups,
      entryMode: meal.entryMode === 'cheat' ? 'cheat' : 'precise',
      alcoholG: meal.alcoholG ?? null,
      cheatSliders: (meal.cheatSliders as CheatSlidersPersisted | null) ?? null,
      share: share ? { shareId: share.id, visibility: share.visibility } : null,
      portionFactor: meal.portionFactor ?? 1,
    });
  });
}

export async function loadPendingAnalysesByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PendingMealConfirmation[]> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return loadPendingAnalysesByDateForUser(user.id, parsed);
}

async function loadPendingAnalysesByDateForUser(
  userId: string,
  parsed: LoadMealsByDateInput
): Promise<PendingMealConfirmation[]> {
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  const rows = await db
    .select()
    .from(pendingAnalyses)
    .where(
      and(
        eq(pendingAnalyses.userId, userId),
        gte(pendingAnalyses.loggedAt, dayStart),
        lt(pendingAnalyses.loggedAt, dayEnd)
        // NOT filtered on `expiresAt > now()` any more. That filter hid an
        // unconfirmed meal 30 minutes after it was staged, so a card the user
        // fully intended to save just disappeared out from under them.
        //
        // It was safe to drop because it is not what prevents the duplicate
        // "unsaved" card it was written for. Re-analysis (re-submit, NL-refine,
        // cheat-clarify, retry) is deduped STRUCTURALLY: every analyze caller
        // sends a stable `attemptId`, and `upsertPendingAnalysis` upserts on the
        // `(user_id, attempt_id)` unique index, so a re-run supersedes its own
        // row instead of orphaning one. The time window was the older, weaker
        // guard for the same problem.
        //
        // Nor does it gate confirmability: `confirmAndSaveMealAction` deletes by
        // (id, userId) and never reads `expiresAt`, so an "expired" row was
        // always still confirmable — the 30 minutes only ever decided whether
        // the card was VISIBLE.
        //
        // `expiresAt` is now purely the reaper's input (see loadLoggingDay), so
        // an abandoned row's real lifetime is ~a week rather than 30 minutes.
      )
    )
    .orderBy(desc(pendingAnalyses.loggedAt));

  return rows.flatMap<PendingMealConfirmation>((row) => {
    // Defensive: a row whose stored pipelineResult predates the current shape
    // (legacy/malformed) must not throw and 500 the entire day load via the
    // Promise.all in loadLoggingDay. Guard the whole conversion — any malformed
    // shape is skipped (such a row is un-confirmable anyway, since confirm reads
    // the same pipelineResult).
    try {
      const base = {
        id: row.id,
        rawInput: row.rawInput,
        loggedAt: row.loggedAt.toISOString(),
      };
      // Cheat rows stage a slider spec, not a decomposition PipelineResult, so
      // toParsedMeal (which reads .mealItems) can't apply. Branch on entryMode,
      // mirroring confirmAndSaveMealAction.
      if (row.entryMode === 'cheat') {
        // Validate the staged spec rather than blindly destructuring: a
        // malformed payload (e.g. {}) wouldn't throw and would surface a card
        // with cheatSpec: undefined. Throwing routes it through the catch below,
        // which skips + logs it like any other malformed row.
        const spec = (row.pipelineResult as { spec?: unknown } | null)?.spec;
        if (
          !spec ||
          typeof spec !== 'object' ||
          !Array.isArray((spec as { sliders?: unknown }).sliders)
        ) {
          throw new Error('Malformed cheat pending analysis payload');
        }
        return [{ ...base, cheatSpec: spec as CheatSliderSpec }];
      }
      return [
        {
          ...base,
          parsedMeal: toParsedMeal(row.pipelineResult as PipelineResult),
        },
      ];
    } catch (error) {
      console.error(
        '[loadPendingAnalyses] Skipping pending analysis with malformed pipelineResult',
        { id: row.id, error }
      );
      return [];
    }
  });
}

// Best-effort purge of a user's long-abandoned pending analyses. Never throws:
// its result is discarded and its failure must not affect the day load.
async function reapAbandonedPendingAnalyses(userId: string): Promise<void> {
  try {
    await db
      .delete(pendingAnalyses)
      .where(
        and(
          eq(pendingAnalyses.userId, userId),
          sql`${pendingAnalyses.expiresAt} < now() - interval '7 days'`
        )
      );
  } catch (error) {
    console.error(
      '[loadLoggingDay] failed to reap abandoned pending analyses',
      {
        userId,
        error,
      }
    );
  }
}

export async function loadLoggingDay(input: {
  date: string;
  timezoneOffset: number;
}): Promise<LoggingDayData> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  const [persistedMeals, pendingConfirmations] = await Promise.all([
    loadMealsByDateForUser(user.id, parsed),
    loadPendingAnalysesByDateForUser(user.id, parsed),
    // Hygiene: reap this user's long-abandoned staging rows so the table doesn't
    // grow unbounded. Best-effort:
    //  - swallow its own errors: a failed DELETE (lock/pooler hiccup) must not
    //    reject the whole day load and 500 the logging page.
    //  - only delete rows a full WEEK past expiry, never merely-expired ones.
    //    Since the load above no longer hides expired rows, this reaper IS the
    //    lifetime of an unconfirmed card: it stays visible and confirmable until
    //    reaped, roughly a week after staging. Anything shorter would take a
    //    card off screen while the user still meant to save it, which is exactly
    //    what the old 30-minute display window did.
    //    A pg_cron purge would be the tidier long-term home, but this keeps the
    //    fix self-contained.
    reapAbandonedPendingAnalyses(user.id),
  ]);

  return { persistedMeals, pendingConfirmations };
}

// ---------------------------------------------------------------------------
// C9: Load distinct meal dates for timeline sidebar
// ---------------------------------------------------------------------------

export async function loadMealDates(input: {
  timezoneOffset: number;
}): Promise<string[]> {
  const parsed = loadMealDatesSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Use offset (opposite sign from JS getTimezoneOffset) to compute local date
  // JS getTimezoneOffset(): UTC+7 = -420, UTC-5 = +300
  // To convert UTC → local: UTC + offsetMins = local
  // Use sql.raw() to inline the integer so DISTINCT ON and ORDER BY produce
  // the same SQL text (Drizzle re-parameterizes the same sql`` object which
  // causes PostgreSQL 42P10: "DISTINCT ON expressions must match ORDER BY").
  const offsetMins = -parsed.timezoneOffset;
  const mealDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const pendingDateExpr = sql<string>`DATE(${pendingAnalyses.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;

  const [mealRows, pendingRows] = await Promise.all([
    db
      .selectDistinctOn([mealDateExpr], {
        date: mealDateExpr.as('date'),
      })
      .from(meals)
      .where(eq(meals.userId, user.id))
      .orderBy(desc(mealDateExpr)),
    db
      .selectDistinctOn([pendingDateExpr], {
        date: pendingDateExpr.as('date'),
      })
      .from(pendingAnalyses)
      // Match loadPendingAnalysesByDate, which no longer hides rows by
      // `expiresAt`. Keeping the window here would paint NO timeline dot for a
      // day whose only content is a pending card older than 30 minutes — a day
      // the feed does render. The two queries have to agree on what counts as a
      // live pending card or the sidebar lies about which days have anything.
      .where(eq(pendingAnalyses.userId, user.id))
      .orderBy(desc(pendingDateExpr)),
  ]);

  return Array.from(
    new Set([
      ...mealRows.map((row) => row.date),
      ...pendingRows.map((row) => row.date),
    ])
  ).sort((a, b) => b.localeCompare(a));
}
