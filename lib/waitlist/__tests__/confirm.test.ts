import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { confirmWaitlistSignup } from '@/lib/waitlist/confirm';
import { hashConfirmationToken } from '@/lib/waitlist/token';
import { createFakeDb, type FakeDb } from './fake-db';

type SendEmailFn = typeof import('@/lib/email/send').sendEmail;

const NOW = new Date('2026-07-30T12:00:00.000Z');
const TOKEN = 'tok_abc123';

let fake: FakeDb;
let sendEmail: Mock<SendEmailFn>;

function run(token = TOKEN) {
  return confirmWaitlistSignup(token, {
    db: fake.db,
    sendEmail,
    now: () => NOW,
  });
}

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'row-1',
    email: 'nguyen@example.com',
    locale: 'vi',
    confirmedAt: null,
    confirmationExpiresAt: new Date(NOW.getTime() + 60_000),
    ...overrides,
  };
}

describe('confirmWaitlistSignup', () => {
  beforeEach(() => {
    fake = createFakeDb();
    sendEmail = vi
      .fn<SendEmailFn>()
      .mockResolvedValue({ id: 'email_1', skipped: false });
  });

  it('confirms a pending signup and sends the welcome email', async () => {
    fake.queueSelect([pendingRow()]);

    const result = await run();

    expect(result).toEqual({ status: 'confirmed', locale: 'vi' });
    expect(fake.updates[0].confirmedAt).toEqual(NOW);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('nguyen@example.com');
  });

  it('burns the token so the link is single-use', async () => {
    fake.queueSelect([pendingRow()]);

    await run();

    expect(fake.updates[0].confirmationTokenHash).toBeNull();
    expect(fake.updates[0].confirmationExpiresAt).toBeNull();
  });

  it('reports already (not invalid) and skips the email when it loses the confirm race', async () => {
    // Both requests SELECT the same pending row, but the guarded UPDATE only
    // matches while the token hash is still set — the loser's update touches
    // zero rows. That is the idempotent already-confirmed outcome, and only
    // the winner sends the welcome email.
    fake.queueSelect([pendingRow()]);
    fake.queueUpdate([]); // guarded UPDATE matched nothing — lost the race

    const result = await run();

    expect(result).toEqual({ status: 'already', locale: 'vi' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('looks the row up by hash, not by the raw token', async () => {
    fake.queueSelect([pendingRow()]);
    const hash = hashConfirmationToken(TOKEN);

    await run();

    expect(hash).not.toBe(TOKEN);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports an already-confirmed signup without re-sending', async () => {
    fake.queueSelect([pendingRow({ confirmedAt: NOW })]);

    const result = await run();

    expect(result.status).toBe('already');
    expect(fake.updates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('reports an expired link without confirming', async () => {
    fake.queueSelect([
      pendingRow({
        confirmationExpiresAt: new Date(NOW.getTime() - 60_000),
      }),
    ]);

    const result = await run();

    expect(result).toEqual({ status: 'expired', locale: 'vi' });
    expect(fake.updates).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('reports an unknown token as invalid', async () => {
    fake.queueSelect([]);

    expect(await run()).toEqual({ status: 'invalid', locale: 'en' });
  });

  it('rejects an empty token without touching the database', async () => {
    expect(await run('')).toEqual({ status: 'invalid', locale: 'en' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('falls back to English for an unrecognised stored locale', async () => {
    fake.queueSelect([pendingRow({ locale: 'fr' })]);

    expect((await run()).locale).toBe('en');
  });

  it('still confirms when the welcome email fails', async () => {
    fake.queueSelect([pendingRow()]);
    sendEmail.mockRejectedValue(new Error('provider down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect((await run()).status).toBe('confirmed');
    expect(fake.updates[0].confirmedAt).toEqual(NOW);
    error.mockRestore();
  });
});
