'use server';

import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { isStillStaged } from '@/lib/actions/meals/day/abandoned';
import {
  PENDING_SCAN_LIMIT,
  toStagedCard,
} from '@/lib/actions/meals/day/staged-card';
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

  // ONE snapshot across all three reads.
  //
  // confirmAndSaveMealAction deletes a staged row and inserts its meal inside a
  // single transaction, so a day being confirmed never stops having content.
  // Read separately, the meals scan can land before that commit while the
  // pending scans land after, and the day appears in none of the three results
  // — the timeline drops a day that existed the whole time. That is not
  // staleness, which every read carries; it is a state the database never held,
  // and no merge downstream can recover it.
  //
  // REPEATABLE READ rather than a bare transaction: under READ COMMITTED each
  // STATEMENT takes a fresh snapshot even within one, so the BEGIN alone would
  // change nothing. Read-only, so it cannot hit a serialization failure.
  //
  // The cost is a BEGIN/COMMIT pair. postgres.js pipelines statements on the
  // transaction's reserved connection, so the three reads still go out together
  // rather than round-tripping one at a time.
  const [mealRows, pendingDateRows, scannedRows] = await db.transaction(
    (tx) =>
      Promise.all([
        // Grouped rather than DISTINCT ON so the day's calories come back from the
        // same scan — no second query, and the same (user_id, logged_at) index.
        tx
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
        // WHICH days hold a staged card. Grouped, so it costs one row per day and
        // reads no JSONB — this is what keeps the day LIST complete however many
        // rows the payload scan below had to leave behind.
        //
        // Both pending queries have to agree with the feed on what counts as a
        // live card, or the sidebar describes a day the feed draws differently.
        // That means BOTH halves of loadPendingAnalysesByDate's line, not one:
        //
        // - No `expiresAt > now()`. That 30-minute window hid a card the user
        //   still meant to save, and the feed dropped it; keeping it here would
        //   paint no dot for a day the feed does render.
        // - But DO apply `isStillStaged()`. The feed hides a card past the
        //   7-day reaping horizon, so counting one here masks a real total for
        //   a card nobody can see — the sweep is best-effort and only runs on a
        //   day load, so such rows genuinely linger.
        tx
          .select({ date: pendingDateExpr.as('date') })
          .from(pendingAnalyses)
          .where(and(eq(pendingAnalyses.userId, user.id), isStillStaged()))
          .groupBy(pendingDateExpr),
        // WHETHER those cards are renderable, which needs each row's payload and
        // so cannot be grouped. Capped: see PENDING_SCAN_LIMIT for why an
        // uncapped version grows without bound. Newest first, and `date` is
        // monotonic in `logged_at`, so the scan fills whole days from the top and
        // the shortfall — if any — lands on the oldest day it reached and older.
        tx
          .select({
            id: pendingAnalyses.id,
            rawInput: pendingAnalyses.rawInput,
            loggedAt: pendingAnalyses.loggedAt,
            entryMode: pendingAnalyses.entryMode,
            pipelineResult: pendingAnalyses.pipelineResult,
            date: pendingDateExpr.as('date'),
          })
          .from(pendingAnalyses)
          .where(and(eq(pendingAnalyses.userId, user.id), isStillStaged()))
          .orderBy(desc(pendingAnalyses.loggedAt))
          // One past the cap, purely as a probe: coming back full is how the
          // merge learns there was more to read.
          .limit(PENDING_SCAN_LIMIT + 1),
      ]),
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  );

  // A staged card carries its nutrition inside pipeline_result's JSONB, not in
  // a column. Reaching into that per row would cost far more than the total is
  // worth, so a pending day contributes its DATE and leaves the calories
  // unknown until it is confirmed.
  const kcalByDate = new Map<string, number | null>();
  for (const row of mealRows) {
    kcalByDate.set(row.date, toKcal(row.kcal));
  }

  // `toStagedCard` is the feed's own renderability test, shared rather than
  // restated. A row it rejects is a card nobody can see or confirm, so it must
  // not mask a total either.
  const scanned = scannedRows.slice(0, PENDING_SCAN_LIMIT);
  const renderableDates = new Set<string>();
  for (const row of scanned) {
    if (toStagedCard(row)) renderableDates.add(row.date);
  }
  // The cap's blind spot, as a date: the probe row's day, and everything
  // below it.
  //
  // The probe is the FIRST row the scan did not inspect, which makes its day
  // the first one anything is unknown about — not the last day the scan
  // touched. Those differ exactly when the probe falls on an older day, which
  // means the day above it ended inside the scan and every row on it was
  // seen. Reading the boundary off `scanned.at(-1)` instead would give up that
  // day's real total for nothing. Absent a probe row, the scan read everything
  // and nothing is undecided.
  const undecidedFrom = scannedRows[PENDING_SCAN_LIMIT]?.date ?? null;

  // The union of what EITHER pending scan saw.
  //
  // The shared snapshot above should make the two agree, so this is belt and
  // braces rather than a live case — but it costs two lines and it is the
  // difference between a merge that is correct on its own terms and one that
  // silently depends on an isolation level set thirty lines away. If a pooler
  // or a future refactor ever weakens that, the failure this prevents is a
  // renderable card being dropped on the floor: a pending-only day vanishing,
  // or a day that holds a card keeping a complete-looking total.
  const pendingDates = new Set(pendingDateRows.map((row) => row.date));
  for (const date of renderableDates) pendingDates.add(date);

  for (const date of pendingDates) {
    // Masking overwrites any saved-meal sum: a day holding BOTH a saved meal
    // and a staged card knows only part of what was eaten, and a partial total
    // is the one thing worse than none — it looks complete. Same rule as the
    // CASE guard above, one layer up.
    //
    // An undecided day masks too. Guessing "no renderable card down there"
    // would be guessing in the direction that invents a complete-looking
    // total; unknown is the honest answer and the safe one. A day the scan
    // DID cover keeps its total when nothing on it was renderable, so the cap
    // costs precision only where it actually ran out.
    const undecided = undecidedFrom !== null && date <= undecidedFrom;
    if (undecided || renderableDates.has(date)) kcalByDate.set(date, null);
  }

  return Array.from(kcalByDate, ([date, kcal]) => ({ date, kcal })).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
}

/**
 * SUM over a `numeric` column arrives as a STRING from postgres.js, which
 * hands numerics back as text so large values keep their precision. Left
 * uncoerced it reaches the sidebar as "1842.50" and renders raw.
 */
function toKcal(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
