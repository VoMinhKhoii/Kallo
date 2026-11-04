// The tick end to end over a mocked database seam: who is due on their own
// clock, that a decided checkpoint is never decided again, that only the
// claims THIS tick won are pushed, and what the push carries.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.unmock('next-intl');

const load = vi.hoisted(() => ({
  loadCandidates: vi.fn(),
  loadDecided: vi.fn(),
  loadRecentMeals: vi.fn(),
  loadDayMarks: vi.fn(),
  claimReminders: vi.fn(),
  loadTokens: vi.fn(),
}));
vi.mock('@/lib/domain/reminders/load', () => load);
const recordPushResults = vi.hoisted(() => vi.fn());
vi.mock('@/lib/domain/notifications/push-delivery', () => ({
  recordPushResults,
}));

import { verifyCloseDayToken } from '@/lib/domain/reminders/action-token';
import { runReminderTick } from '@/lib/domain/reminders/tick';
import type { PushMessage, PushSender } from '@/lib/infra/push/types';

const SECRET = 'action-secret';
const HANOI = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NEW_YORK = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
// 14:00Z = 21:00 in Ho Chi Minh City, 09:00 in New York (EST).
const NOW = new Date('2026-11-04T14:00:00Z');

function candidate(userId: string, timeZone: string, extra = {}) {
  return {
    userId,
    timeZone,
    calorieTarget: 1932,
    preferredLocale: 'en',
    lastOpenedAt: null,
    lastPushedAt: null,
    ...extra,
  };
}

function sender() {
  const sent: PushMessage[] = [];
  const push: PushSender = {
    send: vi.fn(async (messages: PushMessage[]) => {
      sent.push(...messages);
      return messages.map((m) => ({
        token: m.token,
        ok: true,
        shouldPrune: false,
      }));
    }),
  };
  return { push, sent };
}

describe('runReminderTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    load.loadDecided.mockResolvedValue([]);
    load.loadRecentMeals.mockResolvedValue([]);
    load.loadDayMarks.mockResolvedValue([]);
    load.loadTokens.mockResolvedValue([{ userId: HANOI, token: 'aa' }]);
    load.claimReminders.mockImplementation(
      async (rows: { userId: string; outcome: string }[]) =>
        new Set(rows.filter((r) => r.outcome === 'sent').map((r) => r.userId))
    );
  });

  it('only considers users whose own clock is at a checkpoint', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh'),
      // 09:00 in New York is between checkpoints (08:00's window closed at 09:30
      // — still open, but yesterday is empty, so it is skipped, not sent).
      candidate(NEW_YORK, 'America/New_York'),
    ]);
    const { push, sent } = sender();

    const summary = await runReminderTick({
      sender: push,
      actionSecret: SECRET,
      now: NOW,
    });

    expect(summary).toMatchObject({
      candidates: 2,
      due: 2,
      sent: 1,
      skipped: 1,
    });
    const rows = load.claimReminders.mock.calls[0][0];
    expect(rows).toEqual([
      {
        userId: HANOI,
        localDate: '2026-11-04',
        checkpointHour: 21,
        outcome: 'sent',
        reason: null,
      },
      {
        userId: NEW_YORK,
        localDate: '2026-11-04',
        checkpointHour: 8,
        outcome: 'skipped',
        reason: 'empty_day',
      },
    ]);
    expect(sent).toHaveLength(1);
  });

  it('sends the 21:00 reminder with its category, collapse key and a working close-day token', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh'),
    ]);
    load.loadRecentMeals.mockResolvedValue([
      {
        userId: HANOI,
        // 12:30 local on the 4th.
        loggedAt: new Date('2026-11-04T05:30:00Z'),
        createdAt: new Date('2026-11-04T05:31:00Z'),
        calories: 1243,
      },
    ]);
    const { push, sent } = sender();

    await runReminderTick({ sender: push, actionSecret: SECRET, now: NOW });

    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message).toMatchObject({
      token: 'aa',
      title: '',
      body: '689 kcal left today. Anything else, or done for today?',
      category: 'REMINDER_EVENING',
      collapseKey: 'reminder:2026-11-04',
    });
    expect(message.data).toMatchObject({
      type: 'reminder.checkpoint',
      date: '2026-11-04',
      checkpoint: '21',
    });
    expect(verifyCloseDayToken(SECRET, message.data.actionToken, NOW)).toEqual({
      userId: HANOI,
      date: '2026-11-04',
    });
    expect(recordPushResults).toHaveBeenCalledTimes(1);
  });

  it('never decides a checkpoint twice', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh'),
    ]);
    load.loadDecided.mockResolvedValue([
      {
        userId: HANOI,
        localDate: '2026-11-04',
        checkpointHour: 21,
        outcome: 'skipped',
        createdAt: new Date('2026-11-04T14:00:00Z'),
      },
    ]);
    const { push, sent } = sender();

    const summary = await runReminderTick({
      sender: push,
      actionSecret: SECRET,
      now: new Date('2026-11-04T14:15:00Z'),
    });

    expect(summary.due).toBe(1);
    expect(load.claimReminders).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('pushes nothing for a claim another tick already won', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh'),
    ]);
    load.claimReminders.mockResolvedValue(new Set());
    const { push, sent } = sender();

    const summary = await runReminderTick({
      sender: push,
      actionSecret: SECRET,
      now: NOW,
    });

    expect(summary.sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('writes nothing while it waits out another recent push', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh', {
        lastPushedAt: new Date('2026-11-04T13:50:00Z'),
      }),
    ]);
    const { push } = sender();

    const summary = await runReminderTick({
      sender: push,
      actionSecret: SECRET,
      now: NOW,
    });

    expect(summary.waiting).toBe(1);
    expect(load.claimReminders.mock.calls[0][0]).toEqual([]);
  });

  it('skips a day the user closed', async () => {
    load.loadCandidates.mockResolvedValue([
      candidate(HANOI, 'Asia/Ho_Chi_Minh'),
    ]);
    load.loadDayMarks.mockResolvedValue([
      {
        userId: HANOI,
        localDate: '2026-11-04',
        createdAt: new Date('2026-11-04T13:00:00Z'),
      },
    ]);
    const { push, sent } = sender();

    await runReminderTick({ sender: push, actionSecret: SECRET, now: NOW });

    expect(load.claimReminders.mock.calls[0][0][0]).toMatchObject({
      outcome: 'skipped',
      reason: 'closed',
    });
    expect(sent).toHaveLength(0);
  });

  it('skips a stored zone the runtime cannot read instead of failing the tick', async () => {
    load.loadCandidates.mockResolvedValue([candidate(HANOI, 'Mars/Olympus')]);
    const { push } = sender();

    const summary = await runReminderTick({
      sender: push,
      actionSecret: SECRET,
      now: NOW,
    });

    expect(summary).toMatchObject({ candidates: 1, due: 0 });
  });
});
