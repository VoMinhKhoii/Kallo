'use server';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { timezoneOffsetSchema } from '@/lib/core/validation/primitives';
import type { MealDateSummary } from '@/lib/domain/logging/types';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';

const loadMealDatesSchema = z.object({
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * The timeline's index: every day the user has anything on, and what it came
 * to. Separate from `load-meals.ts`, which answers "what is IN this day" — this
 * answers "which days exist", for the sidebar and for the public dates route.
 */
export async function loadMealDates(input: {
  timezoneOffset: number;
}): Promise<MealDateSummary[]> {
  const parsed = loadMealDatesSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Use offset (opposite sign from JS getTimezoneOffset) to compute local date
  // JS getTimezoneOffset(): UTC+7 = -420, UTC-5 = +300
  // To convert UTC → local: UTC + offsetMins = local
  // sql.raw() inlines the integer so the GROUP BY matches the projected
  // expression as SQL TEXT — Drizzle re-parameterizes the same sql`` object,
  // and a $1 in one place and $2 in the other is not the same expression to
  // PostgreSQL.
  const offsetMins = -parsed.timezoneOffset;
  const mealDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const pendingDateExpr = sql<string>`DATE(${pendingAnalyses.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;

  const [mealRows, pendingRows] = await Promise.all([
    // Grouped rather than DISTINCT ON so the day's calories come back from the
    // same scan — no second query, and the same (user_id, logged_at) index.
    db
      .select({
        date: mealDateExpr.as('date'),
        // NULL unless EVERY meal on the day has calories. Postgres SUM skips
        // NULL rows, so a 500 kcal meal beside a legacy row with unknown
        // calories would otherwise report a clean 500 — an incomplete total
        // wearing the face of a complete one. The comparison has to happen
        // inside the aggregate; once the rows are summed the difference is
        // gone.
        kcal: sql<
          string | number | null
        >`CASE WHEN COUNT(*) = COUNT(${meals.caloriesKcal}) THEN SUM(${meals.caloriesKcal}) END`,
      })
      .from(meals)
      .where(eq(meals.userId, user.id))
      .groupBy(mealDateExpr),
    db
      .select({ date: pendingDateExpr.as('date') })
      .from(pendingAnalyses)
      // Match loadPendingAnalysesByDate, which no longer hides rows by
      // `expiresAt`. Keeping the window here would paint NO timeline dot for a
      // day whose only content is a pending card older than 30 minutes — a day
      // the feed does render. The two queries have to agree on what counts as a
      // live pending card or the sidebar lies about which days have anything.
      .where(eq(pendingAnalyses.userId, user.id))
      .groupBy(pendingDateExpr),
  ]);

  // A staged card carries its nutrition inside pipeline_result's JSONB, not in
  // a column. Reaching into that per row would cost far more than the total is
  // worth, so a pending day contributes its DATE and leaves the calories
  // unknown until it is confirmed.
  const kcalByDate = new Map<string, number | null>();
  for (const row of mealRows) {
    kcalByDate.set(row.date, toKcal(row.kcal));
  }
  // Unconditionally, overwriting any saved-meal sum. A day holding BOTH a
  // saved meal and a pending card knows only part of what was eaten, and a
  // partial total is the one thing worse than none — it looks complete. Same
  // rule as the CASE guard above, one layer up.
  for (const row of pendingRows) {
    kcalByDate.set(row.date, null);
  }

  return Array.from(kcalByDate, ([date, kcal]) => ({ date, kcal })).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
}

/**
 * SUM over a `numeric` column arrives as a STRING from node-postgres, which
 * hands numerics back as text so large values keep their precision. Left
 * uncoerced it reaches the sidebar as "1842.50" and renders raw.
 */
function toKcal(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
