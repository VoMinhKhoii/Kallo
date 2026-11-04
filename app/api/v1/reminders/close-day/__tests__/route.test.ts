import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { closeDay, selectProfile } = vi.hoisted(() => ({
  closeDay: vi.fn(),
  selectProfile: vi.fn(),
}));
vi.mock('@/lib/domain/meals/day-completion', () => ({ closeDay }));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: selectProfile }) }),
    }),
  },
}));

import { POST } from '@/app/api/v1/reminders/close-day/route';
import { signCloseDayToken } from '@/lib/domain/reminders/action-token';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SECRET = 'action-secret';

function request(body: unknown) {
  return new Request('https://kallo.test/api/v1/reminders/close-day', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/reminders/close-day', () => {
  beforeEach(() => {
    vi.stubEnv('REMINDER_ACTION_SECRET', SECRET);
    closeDay.mockReset();
    closeDay.mockResolvedValue(undefined);
    selectProfile.mockResolvedValue([{ timeZone: 'Asia/Ho_Chi_Minh' }]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('closes the signed day in the user’s own time zone', async () => {
    const token = signCloseDayToken(SECRET, {
      userId: USER,
      date: '2026-11-04',
      now: new Date(),
    });

    const response = await POST(request({ token }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      closed: true,
      date: '2026-11-04',
    });
    expect(closeDay).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        date: '2026-11-04',
        // Midnight in Ho Chi Minh City (+7).
        dayStart: new Date('2026-11-03T17:00:00Z'),
        dayEnd: new Date('2026-11-04T17:00:00Z'),
      })
    );
  });

  it('refuses a forged token before reading the database', async () => {
    const forged = signCloseDayToken('not-the-secret', {
      userId: USER,
      date: '2026-11-04',
      now: new Date(),
    });

    const response = await POST(request({ token: forged }));

    expect(response.status).toBe(401);
    expect(selectProfile).not.toHaveBeenCalled();
    expect(closeDay).not.toHaveBeenCalled();
  });

  it('rejects a body without a token', async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });
});
