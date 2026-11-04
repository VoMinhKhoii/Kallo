import 'server-only';
import {
  isValidTimeZone,
  shiftDayKey,
  zonedClock,
  zonedDayRange,
} from '@/lib/core/date/zoned';
import type { PushSender } from '@/lib/infra/push/types';
import { decideReminder } from './gates';
import {
  claimReminders,
  loadCandidates,
  loadClosedDays,
  loadDecided,
  loadRecentMeals,
  type ReminderCandidate,
  type ReminderRow,
} from './load';
import { type Checkpoint, dueCheckpoint } from './schedule';
import { type OutgoingReminder, sendReminders } from './send';

/**
 * One reminder tick (every 15 minutes, `POST /api/v1/reminders/tick`): find
 * the users whose local clock is inside a checkpoint's window, run each one
 * through the gates, write the decisions, and push the ones that won.
 * docs/NOTIFICATIONS.md → "Reminders".
 */

export interface TickSummary {
  candidates: number;
  due: number;
  sent: number;
  skipped: number;
  waiting: number;
  delivered: number;
}

interface Due {
  candidate: ReminderCandidate;
  checkpoint: Checkpoint;
  today: string;
  aboutDate: string;
  dayStart: Date;
  dayEnd: Date;
}

/** Look-back for "newest meal": wide enough to answer the ignored gate. */
const MEAL_LOOKBACK_MS = 48 * 60 * 60 * 1000;

function dueFor(candidate: ReminderCandidate, now: Date): Due | null {
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

export async function runReminderTick(input: {
  sender: PushSender;
  actionSecret: string;
  now?: Date;
}): Promise<TickSummary> {
  const now = input.now ?? new Date();
  const candidates = await loadCandidates();
  let due = candidates.flatMap((c) => dueFor(c, now) ?? []);
  const summary: TickSummary = {
    candidates: candidates.length,
    due: due.length,
    sent: 0,
    skipped: 0,
    waiting: 0,
    delivered: 0,
  };
  if (due.length === 0) return summary;

  const userIds = due.map((d) => d.candidate.userId);
  const decided = await loadDecided(userIds, [
    ...new Set(due.map((d) => d.today)),
  ]);
  const sentToday = new Map<string, Date[]>();
  const done = new Set<string>();
  for (const row of decided) {
    const key = `${row.userId}|${row.localDate}`;
    done.add(`${key}|${row.checkpointHour}`);
    if (row.outcome === 'sent') {
      sentToday.set(key, [...(sentToday.get(key) ?? []), row.createdAt]);
    }
  }
  due = due.filter(
    (d) => !done.has(`${d.candidate.userId}|${d.today}|${d.checkpoint.hour}`)
  );
  if (due.length === 0) return summary;

  const remaining = due.map((d) => d.candidate.userId);
  const since = new Date(
    Math.min(
      now.getTime() - MEAL_LOOKBACK_MS,
      ...due.map((d) => d.dayStart.getTime())
    )
  );
  const until = new Date(
    Math.max(now.getTime() + 1, ...due.map((d) => d.dayEnd.getTime()))
  );
  const [recentMeals, closed] = await Promise.all([
    loadRecentMeals(remaining, since, until),
    loadClosedDays(remaining, [...new Set(due.map((d) => d.aboutDate))]),
  ]);

  const rows: ReminderRow[] = [];
  const outgoing = new Map<string, OutgoingReminder>();
  for (const d of due) {
    const { userId } = d.candidate;
    const mine = recentMeals.filter((m) => m.userId === userId);
    const ofDay = mine.filter(
      (m) => m.loggedAt >= d.dayStart && m.loggedAt < d.dayEnd
    );
    const dayCalories = ofDay.reduce((sum, m) => sum + (m.calories ?? 0), 0);
    const lastMealAt = mine.reduce<Date | null>(
      (latest, m) => (!latest || m.createdAt > latest ? m.createdAt : latest),
      null
    );
    const decision = decideReminder({
      checkpoint: d.checkpoint,
      calorieTarget: d.candidate.calorieTarget,
      dayCalories,
      dayHasMeal: ofDay.length > 0,
      dayClosed: closed.has(`${userId}|${d.aboutDate}`),
      lastMealAt,
      lastOpenedAt: d.candidate.lastOpenedAt,
      lastPushedAt: d.candidate.lastPushedAt,
      sentToday: (sentToday.get(`${userId}|${d.today}`) ?? []).sort(
        (a, b) => a.getTime() - b.getTime()
      ),
      now,
    });
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
      outgoing.set(userId, {
        userId,
        hour: d.checkpoint.hour,
        preferredLocale: d.candidate.preferredLocale,
        today: d.today,
        aboutDate: d.aboutDate,
        dayCalories,
        calorieTarget: d.candidate.calorieTarget,
      });
    }
  }

  const claimed = await claimReminders(rows);
  summary.skipped = rows.filter((r) => r.outcome === 'skipped').length;
  const winners = [...outgoing.values()].filter((r) => claimed.has(r.userId));
  summary.sent = winners.length;
  summary.delivered = await sendReminders(
    winners,
    input.sender,
    input.actionSecret,
    now
  );
  return summary;
}
