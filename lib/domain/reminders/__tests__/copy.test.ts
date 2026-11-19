import { describe, expect, it } from 'vitest';
import { reminderCopy } from '@/lib/domain/reminders/copy';
import { CHECKPOINTS } from '@/lib/domain/reminders/schedule';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';

const at = (hour: number) => {
  const found = CHECKPOINTS.find((c) => c.hour === hour);
  if (!found) throw new Error(`no checkpoint ${hour}`);
  return found;
};

/** Consecutive local dates, across a month and a year boundary. */
function days(from: string, count: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10)
  );
}

describe('reminderCopy', () => {
  it('takes one of the checkpoint’s lines, in the user’s language', () => {
    expect(enActivity.reminder.morning).toContain(
      reminderCopy(at(10), 'en', '2026-11-17')
    );
    expect(viActivity.reminder.evening).toContain(
      reminderCopy(at(21), 'vi', '2026-11-17')
    );
  });

  it('gives the same line all day, and a different one the next day', () => {
    for (const checkpoint of CHECKPOINTS) {
      for (const locale of ['en', 'vi'] as const) {
        const seq = days('2026-12-20', 40).map((d) =>
          reminderCopy(checkpoint, locale, d)
        );
        for (let i = 1; i < seq.length; i++) {
          expect(seq[i], `${checkpoint.copyKey} ${locale} day ${i}`).not.toBe(
            seq[i - 1]
          );
        }
        // Every line comes round within one cycle.
        expect(new Set(seq).size).toBe(
          (locale === 'en' ? enActivity : viActivity).reminder[
            checkpoint.copyKey
          ].length
        );
      }
    }
  });

  it('pairs each English line with the Vietnamese line at the same place', () => {
    for (const key of [
      'yesterday',
      'morning',
      'afternoon',
      'evening',
    ] as const) {
      expect(viActivity.reminder[key]).toHaveLength(
        enActivity.reminder[key].length
      );
    }
    const index = (d: string) =>
      enActivity.reminder.yesterday.indexOf(reminderCopy(at(8), 'en', d));
    const day = '2027-03-04';
    expect(reminderCopy(at(8), 'vi', day)).toBe(
      viActivity.reminder.yesterday[index(day)]
    );
  });

  it('never quotes a number placeholder: the lock screen is public', () => {
    for (const locale of [enActivity, viActivity]) {
      for (const lines of Object.values(locale.reminder)) {
        for (const line of lines) expect(line).not.toMatch(/[{}]|kcal/);
      }
    }
  });

  it('gives each checkpoint its category, and the close button only to 08:00 and 21:00', () => {
    expect(
      CHECKPOINTS.map((c) => [c.hour, c.category, c.closesDay, c.type])
    ).toEqual([
      [8, 'REMINDER_YESTERDAY', true, 'reminder.yesterday'],
      [10, 'REMINDER_LOG', false, 'reminder.checkpoint'],
      [15, 'REMINDER_LOG', false, 'reminder.checkpoint'],
      [21, 'REMINDER_EVENING', true, 'reminder.checkpoint'],
    ]);
  });
});
