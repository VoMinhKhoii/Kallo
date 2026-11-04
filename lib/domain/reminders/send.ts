import 'server-only';
import { safeError } from '@/lib/core/errors/safe-error';
import { toPushLocale } from '@/lib/domain/notifications/push-copy';
import { recordPushResults } from '@/lib/domain/notifications/push-delivery';
import type { PushMessage, PushSender } from '@/lib/infra/push/types';
import { signCloseDayToken } from './action-token';
import { reminderCopy } from './copy';
import { loadTokens } from './load';
import { CHECKPOINTS, type CheckpointHour, reminderTypeFor } from './schedule';

/** One reminder that won its claim and now goes to every device of its user. */
export interface OutgoingReminder {
  userId: string;
  hour: CheckpointHour;
  preferredLocale: string | null;
  /** The user's local date today — the collapse key's day. */
  today: string;
  /** The day the reminder is about (yesterday for 08:00). */
  aboutDate: string;
  dayCalories: number;
  calorieTarget: number;
}

/** HTTP/2 streams per batch — well under APNs' concurrent-stream ceiling. */
const SEND_CHUNK = 100;

/** The two checkpoints whose notice carries a "close the day" button. */
const CLOSES_DAY = new Set<CheckpointHour>([8, 21]);

function messagesFor(
  reminder: OutgoingReminder,
  tokens: string[],
  actionSecret: string,
  now: Date
): PushMessage[] {
  const checkpoint = CHECKPOINTS.find((c) => c.hour === reminder.hour);
  if (!checkpoint) return [];
  const { body, category } = reminderCopy(
    reminder.hour,
    toPushLocale(reminder.preferredLocale),
    reminder
  );
  const data: Record<string, string> = {
    type: reminderTypeFor(checkpoint),
    date: reminder.aboutDate,
    checkpoint: String(reminder.hour),
  };
  if (CLOSES_DAY.has(reminder.hour)) {
    data.actionToken = signCloseDayToken(actionSecret, {
      userId: reminder.userId,
      date: reminder.aboutDate,
      now,
    });
  }
  return tokens.map((token) => ({
    token,
    title: '',
    body,
    data,
    category,
    conversationId: 'reminders',
    // One live reminder per day: a new one replaces an unanswered one.
    collapseKey: `reminder:${reminder.today}`,
  }));
}

/**
 * Push each claimed reminder. Push-only, like `chat.message`: no
 * notifications row and no badge. Never throws — the claims are already
 * written, and a failed send is one lost reminder, not a failed tick.
 */
export async function sendReminders(
  reminders: OutgoingReminder[],
  sender: PushSender,
  actionSecret: string,
  now: Date
): Promise<number> {
  if (reminders.length === 0) return 0;
  try {
    const tokens = await loadTokens(reminders.map((r) => r.userId));
    const byUser = new Map<string, string[]>();
    for (const row of tokens) {
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.token]);
    }
    const messages = reminders.flatMap((reminder) =>
      messagesFor(
        reminder,
        byUser.get(reminder.userId) ?? [],
        actionSecret,
        now
      )
    );
    let delivered = 0;
    for (let i = 0; i < messages.length; i += SEND_CHUNK) {
      const results = await sender.send(messages.slice(i, i + SEND_CHUNK));
      delivered += results.filter((r) => r.ok).length;
      await recordPushResults(results, now);
    }
    return delivered;
  } catch (error) {
    console.error('sendReminders failed', safeError(error));
    return 0;
  }
}
