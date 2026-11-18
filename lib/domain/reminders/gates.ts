import { PARTIAL_DAY_FRACTION } from '@/lib/domain/nutrition/pattern/completeness';
import type { Checkpoint } from './schedule';

/**
 * "Should this reminder fire?" — the ordered gates of docs/NOTIFICATIONS.md →
 * "Reminders". Pure: the tick loads the facts, this decides. Gate 1 (the
 * user's switch) and "no target" are applied by the candidate query, so they
 * never reach here.
 */

const MINUTE = 60 * 1000;
/** Gate 4: someone who logged within this window is already logging. */
export const RECENT_MEAL_MS = 3 * 60 * MINUTE;
/** Gate 5: someone who opened Kallo within this window is already here. */
export const RECENT_OPEN_MS = 45 * MINUTE;
/** Gate 8: never land within this long of any other push. */
export const PUSH_SPACING_MS = 30 * MINUTE;
/**
 * Gate 6: the days away (no app open, meal or closed day since) that still
 * get a reminder, one each. Between them none, and after the last none at all
 * until the person comes back, which restarts the count.
 */
export const AWAY_REMINDER_DAYS: readonly number[] = [1, 3, 5, 7];

export type SkipReason =
  | 'closed'
  | 'unknown_total'
  | 'empty_day'
  | 'on_pace'
  | 'recent_meal'
  | 'recently_opened'
  | 'away'
  | 'ignored';

export type ReminderDecision =
  | { action: 'send' }
  | { action: 'skip'; reason: SkipReason }
  /** Another push landed too recently: decide again on the next tick. */
  | { action: 'wait' };

export interface ReminderFacts {
  checkpoint: Checkpoint;
  calorieTarget: number;
  /** Calories logged on the day the reminder is about. */
  dayCalories: number;
  /** Whether that day has at least one meal. */
  dayHasMeal: boolean;
  /** False when one of its meals has no calorie figure: the total is then
   *  only a floor, and a floor cannot say the day is behind, nor be quoted. */
  dayCaloriesKnown: boolean;
  /** Whether that day is closed ("That's everything I ate", or a reminder's
   *  "That was everything"). */
  dayClosed: boolean;
  /** When the user last logged a meal (its creation, not its meal time). */
  lastMealAt: Date | null;
  /** When the user last closed today or yesterday (in the app or from a
   *  reminder's lock-screen button, which leaves no other trace). */
  lastClosedAt: Date | null;
  /** When the app last checked in from any of the user's devices. */
  lastOpenedAt: Date | null;
  /** When any push last reached any of the user's devices. */
  lastPushedAt: Date | null;
  /** Whole local days since the person's last open, meal or closed day:
   *  0 when it was today, null when there is none at all. */
  daysAway: number | null;
  /** When each reminder already SENT today went out, oldest first. */
  sentToday: Date[];
  now: Date;
}

function within(at: Date | null, ms: number, now: Date): boolean {
  return at !== null && now.getTime() - at.getTime() < ms;
}

/** Whether the day is behind the line this checkpoint draws (gate 3). */
function behind(facts: ReminderFacts): SkipReason | null {
  const { checkpoint, calorieTarget, dayCalories } = facts;
  if (checkpoint.about === 'yesterday') {
    // An empty yesterday has nothing to confirm.
    if (!facts.dayHasMeal) return 'empty_day';
    return dayCalories < PARTIAL_DAY_FRACTION * calorieTarget
      ? null
      : 'on_pace';
  }
  return dayCalories < checkpoint.fraction * calorieTarget ? null : 'on_pace';
}

/**
 * Two reminders in a row went unanswered today: no app open, no meal and no
 * day closed since the earlier of the last two went out (answering either one
 * moves one of those past it).
 */
function twoIgnored(facts: ReminderFacts): boolean {
  const { sentToday } = facts;
  if (sentToday.length < 2) return false;
  const earlier = sentToday[sentToday.length - 2].getTime();
  const answered = [
    facts.lastOpenedAt,
    facts.lastMealAt,
    facts.lastClosedAt,
  ].some((at) => at !== null && at.getTime() >= earlier);
  return !answered;
}

/** Someone who has not been here today gets at most one reminder a day, and
 *  only on the days in `AWAY_REMINDER_DAYS`. */
function tooAway(facts: ReminderFacts): boolean {
  const { daysAway } = facts;
  if (daysAway === 0) return false;
  if (daysAway === null || !AWAY_REMINDER_DAYS.includes(daysAway)) return true;
  return facts.sentToday.length > 0;
}

export function decideReminder(facts: ReminderFacts): ReminderDecision {
  const { now } = facts;
  if (facts.dayClosed) return { action: 'skip', reason: 'closed' };
  // Same rule as the in-app "may be under-logged" notice: a missing calorie
  // figure is unknown, not zero (AGENTS.md, "Null is not zero").
  if (!facts.dayCaloriesKnown) {
    return { action: 'skip', reason: 'unknown_total' };
  }
  const pace = behind(facts);
  if (pace) return { action: 'skip', reason: pace };
  if (
    facts.checkpoint.about === 'today' &&
    within(facts.lastMealAt, RECENT_MEAL_MS, now)
  ) {
    return { action: 'skip', reason: 'recent_meal' };
  }
  if (within(facts.lastOpenedAt, RECENT_OPEN_MS, now)) {
    return { action: 'skip', reason: 'recently_opened' };
  }
  if (tooAway(facts)) return { action: 'skip', reason: 'away' };
  if (twoIgnored(facts)) return { action: 'skip', reason: 'ignored' };
  if (within(facts.lastPushedAt, PUSH_SPACING_MS, now)) {
    return { action: 'wait' };
  }
  return { action: 'send' };
}
