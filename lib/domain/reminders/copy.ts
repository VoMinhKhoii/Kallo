import type { PushLocale } from '@/lib/domain/notifications/push-copy';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';
import type { Checkpoint } from './schedule';

/**
 * Reminder text, in the user's `preferred_locale`, from
 * `messages/{en,vi}/activity.json` → `reminder.*`. Each checkpoint has a list
 * of lines (the first is its main line) and takes one per day by date, so the
 * same reminder never says the same thing two days running. No numbers: the
 * lock screen is public. No title: the notice is headed by the app's name.
 *
 * The buttons are NOT here. iOS draws them from the notification CATEGORY,
 * which the app registers on the device in its own language — the checkpoint
 * only names which one it uses (`schedule.ts`).
 */

const LINES: Record<PushLocale, Record<Checkpoint['copyKey'], string[]>> = {
  en: enActivity.reminder,
  vi: viActivity.reminder,
};

const DAY_MS = 86_400_000;

/** `today` is the user's local date (`YYYY-MM-DD`) the reminder is sent on. */
export function reminderCopy(
  checkpoint: Checkpoint,
  locale: PushLocale,
  today: string
): string {
  const lines = LINES[locale][checkpoint.copyKey];
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / DAY_MS);
  return lines[day % lines.length];
}
