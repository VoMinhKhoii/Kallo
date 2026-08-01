import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const sendMock = vi.fn();

vi.mock('@/lib/email/client', () => ({
  resendClient: () => ({ emails: { send: sendMock } }),
  resetResendClient: () => {},
}));

const { sendEmail } = await import('@/lib/email/send');

const MESSAGE = { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

describe('sendEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips silently when no API key is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendEmail({ to: 'a@b.co', message: MESSAGE });

    expect(result).toEqual({ id: null, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns the provider id on success', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    const result = await sendEmail({ to: 'a@b.co', message: MESSAGE });

    expect(result).toEqual({ id: 'email_1', skipped: false });
  });

  it('passes the sender, reply-to and idempotency key through', async () => {
    vi.stubEnv('EMAIL_FROM', 'Kallo <notifications@mail.kallo.fit>');
    vi.stubEnv('EMAIL_REPLY_TO', 'support@kallo.fit');
    sendMock.mockResolvedValue({ data: { id: 'email_2' }, error: null });

    await sendEmail({
      to: 'a@b.co',
      message: MESSAGE,
      idempotencyKey: 'msg_1',
      tags: [{ name: 'kind', value: 'signup' }],
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Kallo <notifications@mail.kallo.fit>',
        replyTo: 'support@kallo.fit',
        to: 'a@b.co',
        text: 'Hi',
        tags: [{ name: 'kind', value: 'signup' }],
      }),
      { idempotencyKey: 'msg_1' }
    );
  });

  it('maps a throttled provider response to a retryable error', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: 'rate_limit_exceeded',
        message: 'slow down',
        statusCode: 429,
      },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendEmail({ to: 'a@b.co', message: MESSAGE })).rejects.toThrow(
      AppError
    );
    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ retryable: true, status: 429 });
    error.mockRestore();
  });

  it('maps a validation failure to a non-retryable error', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'bad from', statusCode: 422 },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
    error.mockRestore();
  });

  it('wraps a transport failure rather than leaking it', async () => {
    sendMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
