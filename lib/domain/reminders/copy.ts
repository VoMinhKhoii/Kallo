import { createTranslator } from 'next-intl';
import type { PushLocale } from '@/lib/domain/notifications/push-copy';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';
import type { Checkpoint } from './schedule';

/**
 * Reminder text, rendered on the server in the user's `preferred_locale` from
 * the same `messages/{en,vi}/activity.json` the rest of the push copy lives
 * in (`reminder.*`). One question, no exclamation marks, no guilt; the
 * numbers are live. No title: the notice is headed by the app's name.
 *
 * The buttons are NOT here. iOS draws them from the notification CATEGORY,
 * which the app registers on the device in its own language — the checkpoint
 * only names which one it uses (`schedule.ts`).
 */

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
  checkpoint: Checkpoint,
  locale: PushLocale,
  values: { dayCalories: number; calorieTarget: number }
): string {
  const calories = Math.round(values.dayCalories);
  // The 21:00 line only fires under 3/4 of the target, so this stays positive.
  const left = Math.max(
    0,
    Math.round(values.calorieTarget - values.dayCalories)
  );
  return translatorFor(locale)(checkpoint.copyKey, { calories, left });
}
