import { describe, expect, it } from 'vitest';
import {
  byUser,
  type DueReminder,
  dueFor,
  reminderFacts,
  undecided,
} from '@/lib/domain/reminders/facts';
import type { ReminderCandidate } from '@/lib/domain/reminders/load';

const A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const B = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
// 14:00Z = 21:00 in Ho Chi Minh City.
const NOW = new Date('2026-11-04T14:00:00Z');

function candidate(userId: string): ReminderCandidate {
  return {
    userId,
    timeZone: 'Asia/Ho_Chi_Minh',
    calorieTarget: 1932,
    preferredLocale: 'en',
    lastOpenedAt: null,
    lastPushedAt: null,
  };
}

function due(userId = A): DueReminder {
  const found = dueFor(candidate(userId), NOW);
  if (!found) throw new Error('expected a due checkpoint');
  return found;
}

describe('dueFor', () => {
  it('finds the checkpoint on the user’s own clock and the day it is about', () => {
    const d = due();
    expect(d.checkpoint.hour).toBe(21);
    expect(d.today).toBe('2026-11-04');
    expect(d.aboutDate).toBe('2026-11-04');
    expect(d.dayStart.toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });
});

describe('undecided', () => {
  it('drops checkpoints already decided today, and orders today’s sends', () => {
    const decided = [
      {
        userId: A,
        localDate: '2026-11-04',
        checkpointHour: 15,
        outcome: 'sent',
        createdAt: new Date('2026-11-04T08:00:00Z'),
      },
      {
        userId: A,
        localDate: '2026-11-04',
        checkpointHour: 10,
        outcome: 'sent',
        createdAt: new Date('2026-11-04T03:00:00Z'),
      },
      // Yesterday's row is not today's history.
      {
        userId: A,
        localDate: '2026-11-03',
        checkpointHour: 21,
        outcome: 'sent',
        createdAt: new Date('2026-11-03T14:00:00Z'),
      },
      {
        userId: B,
        localDate: '2026-11-04',
        checkpointHour: 21,
        outcome: 'skipped',
        createdAt: NOW,
      },
    ];

    const { pending, sentToday } = undecided([due(A), due(B)], decided);

    expect(pending.map((d) => d.candidate.userId)).toEqual([A]);
    expect(sentToday.get(A)?.map((at) => at.toISOString())).toEqual([
      '2026-11-04T03:00:00.000Z',
      '2026-11-04T08:00:00.000Z',
    ]);
  });
});

describe('reminderFacts', () => {
  it('totals only the day it is about, and finds the newest meal and mark', () => {
    const meals = [
      // Today, local 12:30.
      {
        userId: A,
        loggedAt: new Date('2026-11-04T05:30:00Z'),
        createdAt: new Date('2026-11-04T05:31:00Z'),
        calories: 900,
      },
      // Yesterday, logged late last night: not today's total, but newest.
      {
        userId: A,
        loggedAt: new Date('2026-11-03T16:00:00Z'),
        createdAt: new Date('2026-11-04T06:00:00Z'),
        calories: 400,
      },
    ];
    const marks = [
      {
        userId: A,
        localDate: '2026-11-03',
        createdAt: new Date('2026-11-04T01:10:00Z'),
      },
    ];

    const facts = reminderFacts(due(), {
      meals,
      marks,
      sentToday: [],
      now: NOW,
    });

    expect(facts).toMatchObject({
      dayCalories: 900,
      dayHasMeal: true,
      dayCaloriesKnown: true,
      // Yesterday's mark answers a reminder but does not close today.
      dayClosed: false,
      lastMealAt: new Date('2026-11-04T06:00:00Z'),
      lastClosedAt: new Date('2026-11-04T01:10:00Z'),
    });
  });

  it('marks a total holding an unknown meal as not known', () => {
    const facts = reminderFacts(due(), {
      meals: [
        {
          userId: A,
          loggedAt: new Date('2026-11-04T05:30:00Z'),
          createdAt: new Date('2026-11-04T05:31:00Z'),
          calories: null,
        },
      ],
      marks: [],
      sentToday: [],
      now: NOW,
    });
    expect(facts.dayCaloriesKnown).toBe(false);
  });
});

describe('byUser', () => {
  it('groups rows by owner, keeping order', () => {
    const grouped = byUser([
      { userId: A, n: 1 },
      { userId: B, n: 2 },
      { userId: A, n: 3 },
    ]);
    expect(grouped.get(A)?.map((r) => r.n)).toEqual([1, 3]);
    expect(grouped.get(B)?.map((r) => r.n)).toEqual([2]);
  });
});
