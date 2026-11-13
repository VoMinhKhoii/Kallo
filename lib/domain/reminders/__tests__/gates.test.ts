import { describe, expect, it } from 'vitest';
import {
  decideReminder,
  type ReminderFacts,
} from '@/lib/domain/reminders/gates';
import { CHECKPOINTS, dueCheckpoint } from '@/lib/domain/reminders/schedule';

const NOW = new Date('2026-11-04T03:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const at = (hour: number) => {
  const found = CHECKPOINTS.find((c) => c.hour === hour);
  if (!found) throw new Error(`no checkpoint ${hour}`);
  return found;
};

/** A day that is behind at every checkpoint, with nothing else going on. */
function facts(overrides: Partial<ReminderFacts> = {}): ReminderFacts {
  return {
    checkpoint: at(10),
    calorieTarget: 1932,
    dayCalories: 0,
    dayHasMeal: false,
    dayCaloriesKnown: true,
    dayClosed: false,
    lastMealAt: null,
    lastClosedAt: null,
    lastOpenedAt: null,
    lastPushedAt: null,
    sentToday: [],
    now: NOW,
    ...overrides,
  };
}

describe('dueCheckpoint', () => {
  it('opens each checkpoint at its hour and closes it 90 minutes later', () => {
    expect(dueCheckpoint(10 * 60)?.checkpoint.hour).toBe(10);
    expect(dueCheckpoint(10 * 60 + 89)?.minutesLate).toBe(89);
    expect(dueCheckpoint(10 * 60 + 90)).toBeNull();
    expect(dueCheckpoint(9 * 60 + 29)?.checkpoint.hour).toBe(8);
    expect(dueCheckpoint(9 * 60 + 30)).toBeNull();
    expect(dueCheckpoint(21 * 60 + 15)?.checkpoint.hour).toBe(21);
    expect(dueCheckpoint(12 * 60)).toBeNull();
  });
});

describe('decideReminder — the pace lines', () => {
  it('fires at 10:00 under a quarter of the target, not at or over it', () => {
    expect(decideReminder(facts({ dayCalories: 482 })).action).toBe('send');
    expect(decideReminder(facts({ dayCalories: 483 }))).toEqual({
      action: 'skip',
      reason: 'on_pace',
    });
  });

  it('fires at 15:00 under half and at 21:00 under three quarters', () => {
    expect(
      decideReminder(facts({ checkpoint: at(15), dayCalories: 965 })).action
    ).toBe('send');
    expect(
      decideReminder(facts({ checkpoint: at(15), dayCalories: 1180 })).action
    ).toBe('skip');
    expect(
      decideReminder(facts({ checkpoint: at(21), dayCalories: 1448 })).action
    ).toBe('send');
    expect(
      decideReminder(facts({ checkpoint: at(21), dayCalories: 1449 })).action
    ).toBe('skip');
  });

  it('asks about yesterday only when it has meals and ended under 85%', () => {
    const yesterday = facts({ checkpoint: at(8), dayHasMeal: true });
    expect(decideReminder({ ...yesterday, dayCalories: 1500 }).action).toBe(
      'send'
    );
    // 85% of 1,932 is 1,642.2.
    expect(decideReminder({ ...yesterday, dayCalories: 1643 })).toEqual({
      action: 'skip',
      reason: 'on_pace',
    });
    expect(
      decideReminder({ ...yesterday, dayHasMeal: false, dayCalories: 0 })
    ).toEqual({ action: 'skip', reason: 'empty_day' });
  });
});

describe('decideReminder — the other gates, in order', () => {
  it('never reminds about a closed day, even one far behind', () => {
    expect(decideReminder(facts({ dayClosed: true }))).toEqual({
      action: 'skip',
      reason: 'closed',
    });
  });

  it('never reminds about, or quotes, a total that holds an unknown meal', () => {
    for (const hour of [8, 10, 15, 21]) {
      expect(
        decideReminder(
          facts({
            checkpoint: at(hour),
            dayHasMeal: true,
            dayCalories: 200,
            dayCaloriesKnown: false,
          })
        )
      ).toEqual({ action: 'skip', reason: 'unknown_total' });
    }
  });

  it('leaves someone who logged in the last 3 hours alone (today only)', () => {
    expect(decideReminder(facts({ lastMealAt: minutesAgo(179) }))).toEqual({
      action: 'skip',
      reason: 'recent_meal',
    });
    expect(decideReminder(facts({ lastMealAt: minutesAgo(181) })).action).toBe(
      'send'
    );
    // The 08:00 question is about yesterday; a breakfast just logged does
    // not answer it.
    expect(
      decideReminder(
        facts({
          checkpoint: at(8),
          dayHasMeal: true,
          dayCalories: 900,
          lastMealAt: minutesAgo(10),
        })
      ).action
    ).toBe('send');
  });

  it('leaves someone who opened Kallo in the last 45 minutes alone', () => {
    expect(decideReminder(facts({ lastOpenedAt: minutesAgo(44) }))).toEqual({
      action: 'skip',
      reason: 'recently_opened',
    });
    expect(decideReminder(facts({ lastOpenedAt: minutesAgo(46) })).action).toBe(
      'send'
    );
  });

  it('stops for the day after two reminders in a row went unanswered', () => {
    const sentToday = [minutesAgo(300), minutesAgo(60)];
    expect(decideReminder(facts({ sentToday }))).toEqual({
      action: 'skip',
      reason: 'ignored',
    });
    // Opening the app after the earlier one answered it.
    expect(
      decideReminder(facts({ sentToday, lastOpenedAt: minutesAgo(200) })).action
    ).toBe('send');
    // So did logging a meal after it.
    expect(
      decideReminder(facts({ sentToday, lastMealAt: minutesAgo(200) })).action
    ).toBe('send');
    // So did closing a day from a reminder's lock-screen button, which
    // leaves no app open and no meal behind.
    expect(
      decideReminder(facts({ sentToday, lastClosedAt: minutesAgo(200) })).action
    ).toBe('send');
    // One unanswered reminder is not two.
    expect(decideReminder(facts({ sentToday: [minutesAgo(60)] })).action).toBe(
      'send'
    );
  });

  it('waits, rather than skips, while another push landed in the last 30 minutes', () => {
    expect(decideReminder(facts({ lastPushedAt: minutesAgo(29) }))).toEqual({
      action: 'wait',
    });
    expect(decideReminder(facts({ lastPushedAt: minutesAgo(31) })).action).toBe(
      'send'
    );
  });

  it('checks the day before the spacing: a closed day is skipped, not waited on', () => {
    expect(
      decideReminder(facts({ dayClosed: true, lastPushedAt: minutesAgo(5) }))
    ).toEqual({ action: 'skip', reason: 'closed' });
  });
});
