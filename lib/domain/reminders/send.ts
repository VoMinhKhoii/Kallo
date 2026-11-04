import 'server-only';
import { safeError } from '@/lib/core/errors/safe-error';
import { toPushLocale } from '@/lib/domain/notifications/push-copy';
import {
  loadIosTokens,
  recordPushResults,
} from '@/lib/domain/notifications/push-devices';
import type { PushMessage, PushSender } from '@/lib/infra/push/types';
import { signCloseDayToken } from './action-token';
import { reminderCopy } from './copy';
import type { DueReminder } from './facts';

/** One reminder that won its claim and now goes to every device of its user. */
export interface OutgoingReminder {
  due: DueReminder;
  /** The total the copy quotes — known, never a floor (gate 3). */
  dayCalories: number;
}

/** HTTP/2 streams per batch — well under APNs' concurrent-stream ceiling. */
const SEND_CHUNK = 100;

function messagesFor(
  { due, dayCalories }: OutgoingReminder,
  tokens: string[],
  actionSecret: string,
  now: Date
): PushMessage[] {
  const { checkpoint, candidate } = due;
  const body = reminderCopy(
    checkpoint,
    toPushLocale(candidate.preferredLocale),
    {
      dayCalories,
      calorieTarget: candidate.calorieTarget,
    }
  );
  const data: Record<string, string> = {
    type: checkpoint.type,
    date: due.aboutDate,
    checkpoint: String(checkpoint.hour),
  };
  if (checkpoint.closesDay) {
    // The day's bounds as computed now, in the zone it was scheduled in.
    data.actionToken = signCloseDayToken(actionSecret, {
      userId: candidate.userId,
      date: due.aboutDate,
      dayStart: due.dayStart,
      dayEnd: due.dayEnd,
      now,
    });
  }
  return tokens.map((token) => ({
    token,
    title: '',
    body,
    data,
    category: checkpoint.category,
    conversationId: 'reminders',
    // One live reminder per day: a new one replaces an unanswered one.
    collapseKey: `reminder:${due.today}`,
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
    const tokens = await loadIosTokens(
      reminders.map((r) => r.due.candidate.userId)
    );
    const byUser = new Map<string, string[]>();
    for (const row of tokens) {
      byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.token]);
    }
    const messages = reminders.flatMap((reminder) =>
      messagesFor(
        reminder,
        byUser.get(reminder.due.candidate.userId) ?? [],
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
