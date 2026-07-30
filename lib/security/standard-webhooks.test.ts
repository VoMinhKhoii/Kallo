import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  verifyStandardWebhook,
  type WebhookSignatureHeaders,
} from '@/lib/security/standard-webhooks';

const SECRET_BYTES = randomBytes(24).toString('base64');
const SECRET = `v1,whsec_${SECRET_BYTES}`;
const NOW = new Date('2026-07-30T12:00:00.000Z');
const TIMESTAMP = String(Math.floor(NOW.getTime() / 1000));
const ID = 'msg_2KWPBgLlAfxdpx2AI54pPJ85f4W';
const BODY = '{"user":{"email":"a@b.co"},"email_data":{"token":"123456"}}';

function sign(body: string, secret = SECRET_BYTES, timestamp = TIMESTAMP) {
  const digest = createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(`${ID}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${digest}`;
}

function headers(overrides: Partial<WebhookSignatureHeaders> = {}) {
  return {
    id: ID,
    timestamp: TIMESTAMP,
    signature: sign(BODY),
    ...overrides,
  };
}

describe('verifyStandardWebhook', () => {
  it('accepts a correctly signed payload', () => {
    expect(verifyStandardWebhook(BODY, headers(), SECRET, NOW)).toBe(true);
  });

  it('accepts a secret pasted without the v1,whsec_ prefix', () => {
    expect(verifyStandardWebhook(BODY, headers(), SECRET_BYTES, NOW)).toBe(
      true
    );
  });

  it('rejects a body that was tampered with after signing', () => {
    const tampered = BODY.replace('a@b.co', 'attacker@evil.co');
    expect(verifyStandardWebhook(tampered, headers(), SECRET, NOW)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const other = randomBytes(24).toString('base64');
    const signature = sign(BODY, other);
    expect(
      verifyStandardWebhook(BODY, headers({ signature }), SECRET, NOW)
    ).toBe(false);
  });

  it('rejects a replayed request outside the timestamp tolerance', () => {
    const stale = String(Math.floor(NOW.getTime() / 1000) - 6 * 60);
    const signature = sign(BODY, SECRET_BYTES, stale);
    expect(
      verifyStandardWebhook(
        BODY,
        headers({ timestamp: stale, signature }),
        SECRET,
        NOW
      )
    ).toBe(false);
  });

  it('rejects a timestamp far in the future', () => {
    const ahead = String(Math.floor(NOW.getTime() / 1000) + 10 * 60);
    const signature = sign(BODY, SECRET_BYTES, ahead);
    expect(
      verifyStandardWebhook(
        BODY,
        headers({ timestamp: ahead, signature }),
        SECRET,
        NOW
      )
    ).toBe(false);
  });

  it('accepts when one of several rotated signatures matches', () => {
    const stale = sign(BODY, randomBytes(24).toString('base64'));
    const signature = `${stale} ${sign(BODY)}`;
    expect(
      verifyStandardWebhook(BODY, headers({ signature }), SECRET, NOW)
    ).toBe(true);
  });

  it('ignores asymmetric (v1a) signatures it cannot verify', () => {
    const signature = `v1a,${Buffer.from('nope').toString('base64')}`;
    expect(
      verifyStandardWebhook(BODY, headers({ signature }), SECRET, NOW)
    ).toBe(false);
  });

  it.each([
    ['missing id', { id: null }],
    ['missing timestamp', { timestamp: null }],
    ['missing signature', { signature: null }],
    ['non-numeric timestamp', { timestamp: 'not-a-number' }],
  ])('rejects a request with %s', (_label, overrides) => {
    expect(verifyStandardWebhook(BODY, headers(overrides), SECRET, NOW)).toBe(
      false
    );
  });

  it('rejects when no secret is configured', () => {
    expect(verifyStandardWebhook(BODY, headers(), '', NOW)).toBe(false);
  });
});
