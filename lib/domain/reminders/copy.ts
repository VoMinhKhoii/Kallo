import { createTranslator } from 'next-intl';
import type { PushLocale } from '@/lib/domain/notifications/push-copy';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';
import type { CheckpointHour } from './schedule';

/**
 * Reminder text, rendered on the server in the user's `preferred_locale` from
 * the same `messages/{en,vi}/activity.json` the rest of the push copy lives
 * in (`reminder.*`). One question, no exclamation marks, no guilt; the
 * numbers are live. No title: the notice is headed by the app's name.
 *
 * The buttons are NOT here. iOS draws them from the notification CATEGORY,
 * which the app registers on the device in its own language — the server only
 * names which category each checkpoint uses.
 */

/** iOS categories (registered by the app, `AppDelegate.swift`). */
export const REMINDER_CATEGORY = {
  /** "Add to yesterday" (opens the app) · "That was all" (closes, no UI). */
  yesterday: 'REMINDER_YESTERDAY',
  /** "Log a meal" (opens the app). */
  log: 'REMINDER_LOG',
  /** "Log more" (opens the app) · "I'm done for today" (closes, no UI). */
  evening: 'REMINDER_EVENING',
} as const;

const KEY: Record<CheckpointHour, string> = {
  8: 'yesterday',
  10: 'morning',
  15: 'afternoon',
  21: 'evening',
};

const CATEGORY: Record<CheckpointHour, string> = {
  8: REMINDER_CATEGORY.yesterday,
  10: REMINDER_CATEGORY.log,
  15: REMINDER_CATEGORY.log,
  21: REMINDER_CATEGORY.evening,
};

const translators = new Map<
  PushLocale,
  ReturnType<typeof createReminderTranslator>
>();

function createReminderTranslator(locale: PushLocale) {
  return createTranslator({
    locale,
    messages: {
      activity:
        locale === 'vi' ? (viActivity as typeof enActivity) : enActivity,
    },
    namespace: 'activity.reminder',
  });
}

function translatorFor(locale: PushLocale) {
  let t = translators.get(locale);
  if (!t) {
    t = createReminderTranslator(locale);
    translators.set(locale, t);
  }
  return t;
}

export function reminderCopy(
  hour: CheckpointHour,
  locale: PushLocale,
  values: { dayCalories: number; calorieTarget: number }
): { body: string; category: string } {
  const calories = Math.round(values.dayCalories);
  // The 21:00 line only fires under 3/4 of the target, so this stays positive.
  const left = Math.max(
    0,
    Math.round(values.calorieTarget - values.dayCalories)
  );
  const t = translatorFor(locale);
  return {
    body: t(KEY[hour] as 'morning', { calories, left }),
    category: CATEGORY[hour],
  };
}
