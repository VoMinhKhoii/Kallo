import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { firstMeal, insertValues } = vi.hoisted(() => ({
  firstMeal: vi.fn(),
  insertValues: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: firstMeal }) }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        insertValues(values);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      },
    }),
  },
}));

import { closeDay } from '@/lib/domain/meals/day-completion';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-11-04T14:00:00Z');
const TODAY = {
  date: '2026-11-04',
  dayStart: new Date('2026-11-03T17:00:00Z'),
  dayEnd: new Date('2026-11-04T17:00:00Z'),
};

describe('closeDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firstMeal.mockResolvedValue([{ id: 'meal-1' }]);
  });

  it('closes today — the reminder\'s "I’m done for today" while the day is still running', async () => {
    await closeDay({ userId: USER, ...TODAY, now: NOW });
    expect(insertValues).toHaveBeenCalledWith({
      userId: USER,
      localDate: '2026-11-04',
    });
  });

  it('refuses a day that has not started', async () => {
    await expect(
      closeDay({
        userId: USER,
        date: '2026-11-05',
        dayStart: new Date('2026-11-04T17:00:00Z'),
        dayEnd: new Date('2026-11-05T17:00:00Z'),
        now: NOW,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('refuses an empty day', async () => {
    firstMeal.mockResolvedValue([]);
    await expect(
      closeDay({ userId: USER, ...TODAY, now: NOW })
    ).rejects.toMatchObject({ status: 400 });
    expect(insertValues).not.toHaveBeenCalled();
  });
});
