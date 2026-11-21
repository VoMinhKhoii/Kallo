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
 * A line with `{name}` is said with the name the person asked to be called
 * ("What should we call you?"). Someone who never gave one only gets the
 * lines without it. Line n in English and Vietnamese is the same slot, so a
 * slot that names the person in either language is skipped in both.
 *
 * The buttons are NOT here. iOS draws them from the notification CATEGORY,
 * which the app registers on the device in its own language — the checkpoint
 * only names which one it uses (`schedule.ts`).
 */

type CopyKey = Checkpoint['copyKey'];

const LINES: Record<PushLocale, Record<CopyKey, string[]>> = {
  en: enActivity.reminder,
  vi: viActivity.reminder,
};

const NAME = '{name}';

const named = (key: CopyKey, slot: number) =>
  LINES.en[key][slot].includes(NAME) || LINES.vi[key][slot].includes(NAME);

const slots = (key: CopyKey, withName: boolean) =>
  LINES.en[key]
    .map((_, slot) => slot)
    .filter((slot) => withName || !named(key, slot));

const SLOTS: Record<'withName' | 'noName', Record<CopyKey, number[]>> = {
  withName: {
    yesterday: slots('yesterday', true),
    morning: slots('morning', true),
    afternoon: slots('afternoon', true),
    evening: slots('evening', true),
  },
  noName: {
    yesterday: slots('yesterday', false),
    morning: slots('morning', false),
    afternoon: slots('afternoon', false),
    evening: slots('evening', false),
  },
};

const DAY_MS = 86_400_000;

/**
 * `today` is the user's local date (`YYYY-MM-DD`) the reminder is sent on;
 * `displayName` is their `public_profiles.display_name`, if any.
 */
export function reminderCopy(
  checkpoint: Checkpoint,
  locale: PushLocale,
  today: string,
  displayName: string | null
): string {
  const name = displayName?.trim().replace(/\s+/g, ' ') || null;
  const pool = SLOTS[name ? 'withName' : 'noName'][checkpoint.copyKey];
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / DAY_MS);
  const line = LINES[locale][checkpoint.copyKey][pool[day % pool.length]];
  return name ? line.replaceAll(NAME, () => name) : line;
}
