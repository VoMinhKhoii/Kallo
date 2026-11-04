import 'server-only';
import { shiftDayKey } from '@/lib/core/date/day-key';
import type { PushSender } from '@/lib/infra/push/types';
import { byUser, dueFor, reminderFacts, undecided } from './facts';
import { decideReminder } from './gates';
import {
  claimReminders,
  loadCandidates,
  loadDayMarks,
  loadDecided,
  loadRecentMeals,
  type ReminderRow,
} from './load';
import { type OutgoingReminder, sendReminders } from './send';

/**
 * One reminder tick (every 15 minutes, `POST /api/v1/reminders/tick`): find
 * the users whose local clock is inside a checkpoint's window, run each one
 * through the gates, write the decisions, and push the ones that won.
 * docs/NOTIFICATIONS.md → "Reminders".
 *
 * Load → bucket (`facts.ts`) → decide (`gates.ts`) → claim → send.
 */

export interface TickSummary {
  candidates: number;
  due: number;
  sent: number;
  skipped: number;
  waiting: number;
  delivered: number;
}

/** Look-back for "newest meal": wide enough to answer the ignored gate. */
const MEAL_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export async function runReminderTick(input: {
  sender: PushSender;
  actionSecret: string;
  now?: Date;
}): Promise<TickSummary> {
  const now = input.now ?? new Date();
  const candidates = await loadCandidates();
  const due = candidates.flatMap((c) => dueFor(c, now) ?? []);
  const summary: TickSummary = {
    candidates: candidates.length,
    due: due.length,
    sent: 0,
    skipped: 0,
    waiting: 0,
    delivered: 0,
  };
  if (due.length === 0) return summary;

  const decided = await loadDecided(
    due.map((d) => d.candidate.userId),
    [...new Set(due.map((d) => d.today))]
  );
  const { pending, sentToday } = undecided(due, decided);
  if (pending.length === 0) return summary;

  const userIds = pending.map((d) => d.candidate.userId);
  const since = new Date(
    Math.min(
      now.getTime() - MEAL_LOOKBACK_MS,
      ...pending.map((d) => d.dayStart.getTime())
    )
  );
  const until = new Date(
    Math.max(now.getTime() + 1, ...pending.map((d) => d.dayEnd.getTime()))
  );
  // Today's and yesterday's marks: the one the reminder is about decides gate
  // 2, and any made after a reminder went out answered it.
  const [meals, marks] = await Promise.all([
    loadRecentMeals(userIds, since, until),
    loadDayMarks(userIds, [
      ...new Set(pending.flatMap((d) => [d.today, shiftDayKey(d.today, -1)])),
    ]),
  ]);
  const mealsByUser = byUser(meals);
  const marksByUser = byUser(marks);

  const rows: ReminderRow[] = [];
  const outgoing: OutgoingReminder[] = [];
  for (const d of pending) {
    const { userId } = d.candidate;
    const facts = reminderFacts(d, {
      meals: mealsByUser.get(userId) ?? [],
      marks: marksByUser.get(userId) ?? [],
      sentToday: sentToday.get(userId) ?? [],
      now,
    });
    const decision = decideReminder(facts);
    if (decision.action === 'wait') {
      summary.waiting += 1;
      continue;
    }
    rows.push({
      userId,
      localDate: d.today,
      checkpointHour: d.checkpoint.hour,
      outcome: decision.action === 'send' ? 'sent' : 'skipped',
      reason: decision.action === 'skip' ? decision.reason : null,
    });
    if (decision.action === 'send') {
      outgoing.push({ due: d, dayCalories: facts.dayCalories });
    }
  }

  const claimed = await claimReminders(rows);
  summary.skipped = rows.filter((r) => r.outcome === 'skipped').length;
  const winners = outgoing.filter((r) => claimed.has(r.due.candidate.userId));
  summary.sent = winners.length;
  summary.delivered = await sendReminders(
    winners,
    input.sender,
    input.actionSecret,
    now
  );
  return summary;
}
