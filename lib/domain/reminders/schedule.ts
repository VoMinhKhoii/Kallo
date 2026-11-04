/**
 * The four reminder checkpoints, on the user's own clock. There are no meal
 * slots: each checkpoint asks how much of the day's calorie target is logged.
 * Four checkpoints means at most four reminders a day by construction.
 *
 * Each checkpoint is the one record of everything that differs between them:
 * the line it draws, its copy, its iOS category and whether its notice can
 * close the day.
 */

export type CheckpointHour = 8 | 10 | 15 | 21;

export type ReminderType = 'reminder.checkpoint' | 'reminder.yesterday';

/** iOS categories (registered by the app, `AppDelegate.swift`). */
export const REMINDER_CATEGORY = {
  /** "Add to yesterday" (opens the app) · "That was all" (closes, no UI). */
  yesterday: 'REMINDER_YESTERDAY',
  /** "Log a meal" (opens the app). */
  log: 'REMINDER_LOG',
  /** "Log more" (opens the app) · "I'm done for today" (closes, no UI). */
  evening: 'REMINDER_EVENING',
} as const;

export interface Checkpoint {
  hour: CheckpointHour;
  /** `yesterday` asks about the day before; `today` about the day so far. */
  about: 'today' | 'yesterday';
  /** Share of the target a day should have reached by now (today only). */
  fraction: number;
  type: ReminderType;
  /** Its sentence in `messages/{en,vi}/activity.json` → `reminder.*`. */
  copyKey: 'yesterday' | 'morning' | 'afternoon' | 'evening';
  category: (typeof REMINDER_CATEGORY)[keyof typeof REMINDER_CATEGORY];
  /** Its notice carries a "close the day" button (and so an action token). */
  closesDay: boolean;
}

export const CHECKPOINTS: readonly Checkpoint[] = [
  // 08:00 asks about YESTERDAY against the "partial day" line instead
  // (PARTIAL_DAY_FRACTION), so `fraction` is unused for it.
  {
    hour: 8,
    about: 'yesterday',
    fraction: 0,
    type: 'reminder.yesterday',
    copyKey: 'yesterday',
    category: REMINDER_CATEGORY.yesterday,
    closesDay: true,
  },
  {
    hour: 10,
    about: 'today',
    fraction: 1 / 4,
    type: 'reminder.checkpoint',
    copyKey: 'morning',
    category: REMINDER_CATEGORY.log,
    closesDay: false,
  },
  {
    hour: 15,
    about: 'today',
    fraction: 2 / 4,
    type: 'reminder.checkpoint',
    copyKey: 'afternoon',
    category: REMINDER_CATEGORY.log,
    closesDay: false,
  },
  {
    hour: 21,
    about: 'today',
    fraction: 3 / 4,
    type: 'reminder.checkpoint',
    copyKey: 'evening',
    category: REMINDER_CATEGORY.evening,
    closesDay: true,
  },
];

/**
 * How long after its hour a checkpoint may still fire. Only the spacing gate
 * (another push in the last 30 minutes) holds a reminder back; it is rechecked
 * on every 15-minute tick and given up once this window closes.
 */
export const CHECKPOINT_WINDOW_MINUTES = 90;

/** The checkpoint whose window the local clock is inside, if any. */
export function dueCheckpoint(
  minuteOfDay: number
): { checkpoint: Checkpoint; minutesLate: number } | null {
  for (const checkpoint of CHECKPOINTS) {
    const minutesLate = minuteOfDay - checkpoint.hour * 60;
    if (minutesLate >= 0 && minutesLate < CHECKPOINT_WINDOW_MINUTES) {
      return { checkpoint, minutesLate };
    }
  }
  return null;
}
