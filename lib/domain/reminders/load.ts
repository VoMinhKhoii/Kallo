import 'server-only';
import { and, eq, gt, gte, inArray, lt, max, sql } from 'drizzle-orm';
import { db } from '@/lib/infra/db/client';
import {
  dayCompletionMarks,
  mealReminders,
  meals,
  pushTokens,
  userProfiles,
} from '@/lib/infra/db/schema';

/**
 * Every database read the reminder tick makes. Each is one statement over the
 * whole batch, never one per user: the tick runs on a two-connection pool in
 * dev (eight in prod) and must stay a handful of indexed queries however many
 * users share a checkpoint.
 */

export interface ReminderCandidate {
  userId: string;
  timeZone: string;
  calorieTarget: number;
  preferredLocale: string | null;
  /** Newest `push_tokens.last_seen_at`: the app's last check-in. */
  lastOpenedAt: Date | null;
  /** Newest `push_tokens.last_pushed_at` across the user's devices. */
  lastPushedAt: Date | null;
}

/**
 * Users who can be reminded at all: an iOS device to reach, the switch on, a
 * calorie target to measure against, and a time zone to read the clock in.
 * Driven from `push_tokens` (one small table, ≤10 rows per user) and joined
 * to profiles by primary key, so it never scans everyone who signed up.
 */
export async function loadCandidates(): Promise<ReminderCandidate[]> {
  const rows = await db
    .select({
      userId: userProfiles.userId,
      timeZone: userProfiles.timeZone,
      calorieTarget: userProfiles.calorieTarget,
      preferredLocale: userProfiles.preferredLocale,
      lastOpenedAt: max(pushTokens.lastSeenAt),
      lastPushedAt: max(pushTokens.lastPushedAt),
    })
    .from(pushTokens)
    .innerJoin(userProfiles, eq(userProfiles.userId, pushTokens.userId))
    .where(
      and(
        eq(pushTokens.platform, 'ios'),
        eq(userProfiles.mealRemindersEnabled, true),
        gt(userProfiles.calorieTarget, 0),
        sql`${userProfiles.timeZone} IS NOT NULL`
      )
    )
    .groupBy(userProfiles.userId);
  return rows.flatMap((row) =>
    row.timeZone && row.calorieTarget
      ? [
          {
            userId: row.userId,
            timeZone: row.timeZone,
            calorieTarget: row.calorieTarget,
            preferredLocale: row.preferredLocale,
            lastOpenedAt: row.lastOpenedAt,
            lastPushedAt: row.lastPushedAt,
          },
        ]
      : []
  );
}

export interface DecidedReminder {
  userId: string;
  localDate: string;
  checkpointHour: number;
  outcome: string;
  createdAt: Date;
}

/** Reminder rows already written for these users on these local dates. */
export async function loadDecided(
  userIds: string[],
  dates: string[]
): Promise<DecidedReminder[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: mealReminders.userId,
      localDate: mealReminders.localDate,
      checkpointHour: mealReminders.checkpointHour,
      outcome: mealReminders.outcome,
      createdAt: mealReminders.createdAt,
    })
    .from(mealReminders)
    .where(
      and(
        inArray(mealReminders.userId, userIds),
        inArray(mealReminders.localDate, dates)
      )
    );
}

export interface RecentMeal {
  userId: string;
  loggedAt: Date;
  createdAt: Date;
  calories: number | null;
}

/**
 * Every meal these users logged a time for inside `[since, until)` — enough to
 * total the day each reminder is about and to find each user's newest log.
 * Rides `meals_user_logged_at_idx`; a couple of days of meals per user.
 */
export async function loadRecentMeals(
  userIds: string[],
  since: Date,
  until: Date
): Promise<RecentMeal[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: meals.userId,
      loggedAt: meals.loggedAt,
      createdAt: meals.createdAt,
      calories: meals.caloriesKcal,
    })
    .from(meals)
    .where(
      and(
        inArray(meals.userId, userIds),
        gte(meals.loggedAt, since),
        lt(meals.loggedAt, until)
      )
    );
}

export interface DayMark {
  userId: string;
  localDate: string;
  createdAt: Date;
}

/** The closed-day marks among these users and dates, with when each was made. */
export async function loadDayMarks(
  userIds: string[],
  dates: string[]
): Promise<DayMark[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: dayCompletionMarks.userId,
      localDate: dayCompletionMarks.localDate,
      createdAt: dayCompletionMarks.createdAt,
    })
    .from(dayCompletionMarks)
    .where(
      and(
        inArray(dayCompletionMarks.userId, userIds),
        inArray(dayCompletionMarks.localDate, dates)
      )
    );
}

export interface ReminderRow {
  userId: string;
  localDate: string;
  checkpointHour: number;
  outcome: 'sent' | 'skipped';
  reason: string | null;
}

/**
 * Write the decisions, and return the `sent` ones THIS call claimed. The
 * primary key is the lock: a row another tick already wrote is left alone and
 * not returned, so an overlapping tick can never push the same checkpoint
 * twice. Claimed before sending — a crash between the two loses one reminder,
 * which beats sending it twice.
 */
export async function claimReminders(
  rows: ReminderRow[]
): Promise<Set<string>> {
  if (rows.length === 0) return new Set();
  const claimed = await db
    .insert(mealReminders)
    .values(rows)
    .onConflictDoNothing()
    .returning({
      userId: mealReminders.userId,
      outcome: mealReminders.outcome,
    });
  return new Set(
    claimed.filter((row) => row.outcome === 'sent').map((row) => row.userId)
  );
}

/** Every iOS device of these users. */
export async function loadTokens(
  userIds: string[]
): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: pushTokens.userId, token: pushTokens.token })
    .from(pushTokens)
    .where(
      and(inArray(pushTokens.userId, userIds), eq(pushTokens.platform, 'ios'))
    );
}
