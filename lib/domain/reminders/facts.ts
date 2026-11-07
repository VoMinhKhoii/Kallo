import { shiftDayKey } from '@/lib/core/date/day-key';
import {
  isValidTimeZone,
  zonedClock,
  zonedDayRange,
} from '@/lib/core/date/zoned';
import type { ReminderFacts } from './gates';
import type {
  DayMark,
  DecidedReminder,
  RecentMeal,
  ReminderCandidate,
} from './load';
import { type Checkpoint, dueCheckpoint } from './schedule';

/**
 * From loaded rows to the facts each gate reads. Pure: the tick loads, this
 * buckets and derives, `gates.ts` decides.
 */

/** A user whose clock is inside a checkpoint's window right now. */
export interface DueReminder {
  candidate: ReminderCandidate;
  checkpoint: Checkpoint;
  /** The user's local date now — the day the decision is filed under. */
  today: string;
  /** The day the reminder is about (yesterday for 08:00), and its UTC bounds
   *  in the user's zone. */
  aboutDate: string;
  dayStart: Date;
  dayEnd: Date;
}

export function dueFor(
  candidate: ReminderCandidate,
  now: Date
): DueReminder | null {
  // A zone this runtime cannot read would throw in every formatter call; the
  // registration route validates it, so this only guards older rows.
  if (!isValidTimeZone(candidate.timeZone)) return null;
  const clock = zonedClock(now, candidate.timeZone);
  const due = dueCheckpoint(clock.minuteOfDay);
  if (!due) return null;
  const aboutDate =
    due.checkpoint.about === 'yesterday'
      ? shiftDayKey(clock.date, -1)
      : clock.date;
  return {
    candidate,
    checkpoint: due.checkpoint,
    today: clock.date,
    aboutDate,
    ...zonedDayRange(aboutDate, candidate.timeZone),
  };
}

/** Rows grouped by owner, so each user's facts are a lookup, not a scan. */
export function byUser<T extends { userId: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.userId);
    if (list) list.push(row);
    else grouped.set(row.userId, [row]);
  }
  return grouped;
}

/** The due reminders not yet decided today, and when each user's earlier
 *  reminders today went out (oldest first). */
export function undecided(
  due: readonly DueReminder[],
  decided: readonly DecidedReminder[]
): { pending: DueReminder[]; sentToday: Map<string, Date[]> } {
  const rows = byUser(decided);
  const sentToday = new Map<string, Date[]>();
  const pending = due.filter((d) => {
    const mine = (rows.get(d.candidate.userId) ?? []).filter(
      (row) => row.localDate === d.today
    );
    sentToday.set(
      d.candidate.userId,
      mine
        .filter((row) => row.outcome === 'sent')
        .map((row) => row.createdAt)
        .sort((a, b) => a.getTime() - b.getTime())
    );
    return !mine.some((row) => row.checkpointHour === d.checkpoint.hour);
  });
  return { pending, sentToday };
}

function newest(dates: Date[]): Date | null {
  return dates.reduce<Date | null>(
    (latest, at) => (!latest || at > latest ? at : latest),
    null
  );
}

/** Everything the gates read about one due reminder. */
export function reminderFacts(
  d: DueReminder,
  input: {
    meals: readonly RecentMeal[];
    marks: readonly DayMark[];
    sentToday: Date[];
    now: Date;
  }
): ReminderFacts {
  const ofDay = input.meals.filter(
    (m) => m.loggedAt >= d.dayStart && m.loggedAt < d.dayEnd
  );
  return {
    checkpoint: d.checkpoint,
    calorieTarget: d.candidate.calorieTarget,
    dayCalories: ofDay.reduce((sum, m) => sum + (m.calories ?? 0), 0),
    dayHasMeal: ofDay.length > 0,
    // A meal with no calorie figure makes the total a floor, never a sum.
    dayCaloriesKnown: ofDay.every((m) => m.calories !== null),
    dayClosed: input.marks.some((m) => m.localDate === d.aboutDate),
    lastMealAt: newest(input.meals.map((m) => m.createdAt)),
    // Today's or yesterday's mark made after a reminder answered it: the
    // lock-screen buttons close a day without opening the app.
    lastClosedAt: newest(input.marks.map((m) => m.createdAt)),
    lastOpenedAt: d.candidate.lastOpenedAt,
    lastPushedAt: d.candidate.lastPushedAt,
    sentToday: input.sentToday,
    now: input.now,
  };
}
