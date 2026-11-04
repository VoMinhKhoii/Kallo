import { describe, expect, it, vi } from 'vitest';

vi.unmock('next-intl');

import { reminderCopy } from '@/lib/domain/reminders/copy';
import { CHECKPOINTS } from '@/lib/domain/reminders/schedule';

const at = (hour: number) => {
  const found = CHECKPOINTS.find((c) => c.hour === hour);
  if (!found) throw new Error(`no checkpoint ${hour}`);
  return found;
};

const values = { dayCalories: 1243.4, calorieTarget: 1932 };

describe('reminderCopy', () => {
  it('renders the four checkpoints in English with live numbers', () => {
    expect(reminderCopy(at(8), 'en', values)).toBe(
      'Yesterday ended at 1,243 kcal. Anything missing?'
    );
    expect(reminderCopy(at(10), 'en', values)).toBe(
      'What have you had so far today?'
    );
    expect(reminderCopy(at(15), 'en', { ...values, dayCalories: 540 })).toBe(
      "Anything since this morning? You're at 540 kcal."
    );
    expect(reminderCopy(at(21), 'en', values)).toBe(
      '689 kcal left today. Anything else, or done for today?'
    );
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

  it('renders Vietnamese with Vietnamese digit grouping', () => {
    expect(reminderCopy(at(8), 'vi', values)).toBe(
      'Hôm qua dừng ở 1.243 kcal. Còn thiếu món nào không?'
    );
    expect(reminderCopy(at(10), 'vi', values)).toBe(
      'Từ sáng tới giờ bạn đã ăn gì?'
    );
    expect(reminderCopy(at(21), 'vi', values)).toBe(
      'Hôm nay còn 689 kcal. Ăn thêm gì không, hay xong rồi?'
    );
  });

  it('never asks with an exclamation mark', () => {
    for (const checkpoint of CHECKPOINTS) {
      for (const locale of ['en', 'vi'] as const) {
        expect(reminderCopy(checkpoint, locale, values)).not.toContain('!');
      }
    }
  });
});
