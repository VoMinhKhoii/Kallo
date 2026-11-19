import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runReminderTick } = vi.hoisted(() => ({ runReminderTick: vi.fn() }));
vi.mock('@/lib/domain/reminders/tick', () => ({ runReminderTick }));
vi.mock('@/lib/infra/push/sender', () => ({ getPushSender: () => ({}) }));

import { POST } from '@/app/api/v1/reminders/tick/route';

function request(authorization?: string) {
  return new Request('https://kallo.test/api/v1/reminders/tick', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

describe('POST /api/v1/reminders/tick', () => {
  beforeEach(() => {
    vi.stubEnv('REMINDER_TICK_SECRET', 'tick-secret');
    vi.stubEnv('REMINDER_ACTION_SECRET', 'action-secret');
    runReminderTick.mockReset();
    runReminderTick.mockResolvedValue({ candidates: 0 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('runs the tick for the scheduler’s bearer secret', async () => {
    const response = await POST(request('Bearer tick-secret'));

    expect(response.status).toBe(200);
    expect(runReminderTick).toHaveBeenCalledWith(
      expect.objectContaining({ actionSecret: 'action-secret' })
    );
  });

  it('refuses anyone else without running anything', async () => {
    for (const header of [undefined, 'Bearer wrong', 'tick-secret']) {
      const response = await POST(request(header));
      expect(response.status).toBe(401);
    }
    expect(runReminderTick).not.toHaveBeenCalled();
  });

  it('answers 503 until both secrets are configured', async () => {
    vi.stubEnv('REMINDER_ACTION_SECRET', '');

    const response = await POST(request('Bearer tick-secret'));

    expect(response.status).toBe(503);
    expect(runReminderTick).not.toHaveBeenCalled();
  });
});
