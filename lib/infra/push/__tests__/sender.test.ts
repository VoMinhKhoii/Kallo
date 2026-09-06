// Sender resolution is the last thing that runs before a push leaves the
// process, and it runs inside an `after()` callback on a request that already
// succeeded. So it may not throw — not for missing APNs credentials, and not
// for a malformed signing key. Both degrade to the no-op sender.

import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getPushSender } from '@/lib/infra/push/sender';

const MESSAGE = { token: 't', title: 'Kallo', body: 'hi', data: {} };

function stubIdentity() {
  vi.stubEnv('APNS_KEY_ID', 'ABC123DEFG');
  vi.stubEnv('APNS_TEAM_ID', 'ZNG57U88R5');
  vi.stubEnv('APNS_BUNDLE_ID', 'com.khoivo.nham');
}

describe('getPushSender', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns a no-op sender when APNs is not configured', async () => {
    vi.stubEnv('APNS_KEY_P8', '');
    vi.stubEnv('APNS_KEY_ID', '');

    await expect(getPushSender().send([MESSAGE])).resolves.toEqual([]);
  });

  it('returns a no-op sender when only part of the identity is set', async () => {
    stubIdentity();
    vi.stubEnv('APNS_KEY_P8', '');

    await expect(getPushSender().send([MESSAGE])).resolves.toEqual([]);
  });

  it('degrades to the no-op sender instead of throwing on a malformed .p8', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubIdentity();
    vi.stubEnv('APNS_KEY_P8', '-----BEGIN PRIVATE KEY-----\nnot-a-key\n');

    // Resolution itself must not throw — it runs inside after().
    const sender = getPushSender();

    await expect(sender.send([MESSAGE])).resolves.toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('builds the real sender when the identity and a valid key are set', () => {
    vi.stubEnv('APNS_KEY_P8', '');
    const noop = getPushSender();
    stubIdentity();
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    vi.stubEnv(
      'APNS_KEY_P8',
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    );

    const sender = getPushSender();

    // Delivery mechanics are covered in apns.test.ts; here it is enough that
    // a valid configuration does not fall through to the shared no-op.
    expect(sender.send).not.toBe(noop.send);
  });
});
