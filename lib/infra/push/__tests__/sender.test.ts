// Sender resolution is the last thing that runs before a push leaves the
// process, and it runs inside an `after()` callback on a request that already
// succeeded. So it may not throw — not for a missing service account, and not
// for a malformed one. Both degrade to the no-op sender.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getPushSender } from '@/lib/infra/push/sender';

describe('getPushSender', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns a no-op sender when FCM is not configured', async () => {
    vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', '');

    await expect(
      getPushSender().send([
        { token: 't', title: 'Kallo', body: 'hi', data: {} },
      ])
    ).resolves.toEqual([]);
  });

  it('degrades to the no-op sender instead of throwing on malformed JSON', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', '{ "client_email": ');

    const sender = getPushSender();

    await expect(
      sender.send([{ token: 't', title: 'Kallo', body: 'hi', data: {} }])
    ).resolves.toEqual([]);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
