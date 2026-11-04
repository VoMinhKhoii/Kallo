import { describe, expect, it, vi } from 'vitest';

vi.unmock('next-intl');

import { reminderCopy } from '@/lib/domain/reminders/copy';

const values = { dayCalories: 1243.4, calorieTarget: 1932 };

describe('reminderCopy', () => {
  it('renders the four checkpoints in English with live numbers', () => {
    expect(reminderCopy(8, 'en', values)).toEqual({
      body: 'Yesterday ended at 1,243 kcal. Anything missing?',
      category: 'REMINDER_YESTERDAY',
    });
    expect(reminderCopy(10, 'en', values).body).toBe(
      'What have you had so far today?'
    );
    expect(reminderCopy(15, 'en', { ...values, dayCalories: 540 })).toEqual({
      body: "Anything since this morning? You're at 540 kcal.",
      category: 'REMINDER_LOG',
    });
    expect(reminderCopy(21, 'en', values)).toEqual({
      body: '689 kcal left today. Anything else, or done for today?',
      category: 'REMINDER_EVENING',
    });
  });

  it('renders Vietnamese with Vietnamese digit grouping', () => {
    expect(reminderCopy(8, 'vi', values).body).toBe(
      'Hôm qua dừng ở 1.243 kcal. Còn thiếu món nào không?'
    );
    expect(reminderCopy(10, 'vi', values).body).toBe(
      'Từ sáng tới giờ bạn đã ăn gì?'
    );
    expect(reminderCopy(21, 'vi', values).body).toBe(
      'Hôm nay còn 689 kcal. Ăn thêm gì không, hay xong rồi?'
    );
  });

  it('never asks with an exclamation mark', () => {
    for (const hour of [8, 10, 15, 21] as const) {
      for (const locale of ['en', 'vi'] as const) {
        expect(reminderCopy(hour, locale, values).body).not.toContain('!');
      }
    }
  });
});
