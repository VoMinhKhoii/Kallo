import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import {
  confirmationUrl,
  normaliseEmail,
  signUpForWaitlist,
} from '@/lib/domain/waitlist/signup';
import { createFakeDb, type FakeDb } from '@/lib/infra/db/__fixtures__/fake-db';

type SendEmailFn = typeof import('@/lib/infra/email/send').sendEmail;

const NOW = new Date('2026-07-30T12:00:00.000Z');

let fake: FakeDb;
let sendEmail: Mock<SendEmailFn>;

function run(
  input: WaitlistSignupInput = { email: 'Nguyen@Example.COM', locale: 'vi' },
  context: { ip?: string | null } = { ip: '203.0.113.7' }
) {
  return signUpForWaitlist(input, context, {
    db: fake.db,
    sendEmail,
    now: () => NOW,
  });
}

/** No prior signups from this IP, and no existing row for this address. */
function queueFreshAddress() {
  fake.queueSelect([{ count: 0 }]); // IP quota
  fake.queueSelect([]); // existing row lookup
}

describe('normaliseEmail', () => {
  it('lowercases, trims, and NFC-normalises', () => {
    expect(normaliseEmail('  Nguyen@Example.COM ')).toBe('nguyen@example.com');
    // Decomposed "ề" must collapse onto the composed form.
    expect(normaliseEmail('hòâng@x.vn')).toBe('hòâng@x.vn'.normalize('NFC'));
  });
});

describe('confirmationUrl', () => {
  it('points at the confirm route on the canonical origin', () => {
    const url = new URL(confirmationUrl('tok_123'));
    expect(url.origin).toBe('https://kallo.fit');
    expect(url.pathname).toBe('/api/v1/waitlist/confirm');
    expect(url.searchParams.get('token')).toBe('tok_123');
  });
});

describe('signUpForWaitlist', () => {
  beforeEach(() => {
    fake = createFakeDb();
    sendEmail = vi
      .fn<SendEmailFn>()
      .mockResolvedValue({ id: 'email_1', skipped: false });
  });

  it('stores a normalised, unconfirmed row and mails a confirm link', async () => {
    queueFreshAddress();

    await run();

    expect(fake.inserts).toHaveLength(1);
    const row = fake.inserts[0];
    expect(row.email).toBe('nguyen@example.com');
    expect(row.locale).toBe('vi');
    expect(row.confirmedAt).toBeUndefined();
    expect(row.confirmationTokenHash).toEqual(expect.any(String));
    expect(row.confirmationExpiresAt).toBeInstanceOf(Date);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('nguyen@example.com');
  });

  it('stores only a hash of the token, never the token itself', async () => {
    queueFreshAddress();

    await run();

    const emailed = sendEmail.mock.calls[0][0].message.text;
    const link = emailed.match(
      /https:\/\/kallo\.fit\/api\/v1\/waitlist\/confirm\?\S+/
    );
    expect(link).not.toBeNull();
    const token = new URL(link?.[0] ?? '').searchParams.get('token');

    expect(token).toBeTruthy();
    expect(fake.inserts[0].confirmationTokenHash).not.toBe(token);
    expect(emailed).not.toContain(fake.inserts[0].confirmationTokenHash);
  });

  it('stores a hashed IP, never the raw address', async () => {
    queueFreshAddress();

    await run();

    expect(fake.inserts[0].ipHash).toEqual(expect.any(String));
    expect(fake.inserts[0].ipHash).not.toContain('203.0.113.7');
  });

  it('rotates the token and re-sends for a pending address', async () => {
    fake.queueSelect([{ count: 0 }]);
    fake.queueSelect([
      {
        id: 'row-1',
        confirmedAt: null,
        confirmationSentAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      },
    ]);

    await run();

    expect(fake.inserts).toHaveLength(0);
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].confirmationTokenHash).toEqual(expect.any(String));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not re-send inside the cooldown', async () => {
    fake.queueSelect([{ count: 0 }]);
    fake.queueSelect([
      {
        id: 'row-1',
        confirmedAt: null,
        confirmationSentAt: new Date(NOW.getTime() - 60 * 1000),
      },
    ]);

    await run();

    expect(fake.updates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('clears confirmationSentAt and rethrows when the send fails', async () => {
    // A failed provider call must leave the row retryable: the transaction
    // stamped confirmationSentAt=now, so without this rollback the cooldown
    // would silently block an immediate retry.
    queueFreshAddress();
    sendEmail.mockRejectedValueOnce(new Error('resend down'));

    await expect(run()).rejects.toThrow('resend down');

    // The compensating update clears the sent marker so retry is unblocked.
    const rollback = fake.updates.at(-1);
    expect(rollback).toMatchObject({ confirmationSentAt: null });
  });

  it('sends nothing for an already-confirmed address', async () => {
    fake.queueSelect([{ count: 0 }]);
    fake.queueSelect([
      { id: 'row-1', confirmedAt: NOW, confirmationSentAt: NOW },
    ]);

    await run();

    expect(fake.inserts).toHaveLength(0);
    expect(fake.updates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('resolves identically whether the address is new, pending or confirmed', async () => {
    // New
    queueFreshAddress();
    await expect(run()).resolves.toBeUndefined();
    // Confirmed
    fake = createFakeDb();
    fake.queueSelect([{ count: 0 }]);
    fake.queueSelect([{ id: 'row-1', confirmedAt: NOW }]);
    await expect(run()).resolves.toBeUndefined();
  });

  it('rate-limits a noisy IP', async () => {
    fake.queueSelect([{ count: 5 }]);

    await expect(run()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips the IP quota when no IP is available', async () => {
    fake.queueSelect([]); // existing row lookup — quota query never runs
    await run({ email: 'a@b.co', locale: 'en' }, { ip: null });

    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0].ipHash).toBeNull();
  });

  it('takes an advisory lock before deciding anything', async () => {
    queueFreshAddress();

    await run();

    expect(fake.transactions()).toBe(1);
  });

  it('defaults to English when no locale is supplied', async () => {
    queueFreshAddress();

    await run({ email: 'a@b.co' });

    expect(fake.inserts[0].locale).toBe('en');
  });
});
