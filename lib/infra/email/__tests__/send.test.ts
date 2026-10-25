import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/core/errors/app-error';
import { EMAIL_SEND_TIMEOUT_MS } from '@/lib/infra/email/config';
import { sendEmail } from '@/lib/infra/email/send';

const ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
const MESSAGE = { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

const fetchMock = vi.fn<typeof fetch>();

function apiResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sent(
  outcome: Partial<
    Record<
      'delivered' | 'queued' | 'permanent_bounces' | 'suppressed_recipients',
      string[]
    >
  >
) {
  return {
    success: true,
    errors: [],
    messages: [],
    result: {
      message_id: '<abc@mail.kallo.fit>',
      delivered: [],
      queued: [],
      permanent_bounces: [],
      suppressed_recipients: [],
      ...outcome,
    },
  };
}

/** A fetch that answers only after `ms`, like a slow Cloudflare send. */
function answerAfter(ms: number, response: () => Response) {
  fetchMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(response()), ms);
      })
  );
}

describe('sendEmail', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  let warnLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'test-token');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT_ID);
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips silently when no API token is configured', async () => {
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', '');

    const result = await sendEmail({ to: 'a@b.co', message: MESSAGE });

    expect(result).toEqual({ id: null, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnLog).toHaveBeenCalled();
  });

  it('posts the message to the account send endpoint', async () => {
    vi.stubEnv('EMAIL_FROM', 'Kallo <notifications@mail.kallo.fit>');
    vi.stubEnv('EMAIL_REPLY_TO', 'support@kallo.fit');
    fetchMock.mockResolvedValue(
      apiResponse(200, sent({ delivered: ['a@b.co'] }))
    );

    const result = await sendEmail({ to: 'a@b.co', message: MESSAGE });

    expect(result).toEqual({ id: '<abc@mail.kallo.fit>', skipped: false });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
    // Never abortable: Cloudflare cancels a send whose request is dropped.
    expect(init?.signal).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'Kallo <notifications@mail.kallo.fit>',
      to: ['a@b.co'],
      reply_to: 'support@kallo.fit',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('accepts a send the provider queued rather than delivered', async () => {
    fetchMock.mockResolvedValue(apiResponse(200, sent({ queued: ['a@b.co'] })));

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).resolves.toEqual({ id: '<abc@mail.kallo.fit>', skipped: false });
  });

  it('maps a throttled response to a retryable error', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(429, {
        success: false,
        errors: [{ code: 10004, message: 'email.sending.error.throttled' }],
        result: null,
      })
    );

    const error = await sendEmail({ to: 'a@b.co', message: MESSAGE }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ retryable: true, status: 429 });
  });

  it('maps a provider-side failure with no JSON body to a retryable error', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502 })
    );

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ retryable: true, status: 429 });
  });

  it('maps a rejected request to an internal error', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(400, {
        success: false,
        errors: [
          {
            code: 10001,
            message: 'email.sending.error.invalid_request_schema',
          },
        ],
        result: null,
      })
    );

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
  });

  it('treats a permanent bounce as a failed send, though the API says 200', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(200, sent({ permanent_bounces: ['a@b.co'] }))
    );

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
  });

  it('treats a suppressed recipient as a failed send, though the API says 200', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(200, sent({ suppressed_recipients: ['a@b.co'] }))
    );

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
  });

  it('accepts a success whose optional fields come back null', async () => {
    fetchMock.mockResolvedValue(
      apiResponse(200, {
        success: true,
        errors: null,
        result: {
          message_id: null,
          delivered: ['a@b.co'],
          permanent_bounces: null,
          suppressed_recipients: null,
        },
      })
    );

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).resolves.toEqual({ id: null, skipped: false });
  });

  it('wraps a transport failure rather than leaking it', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('fails loudly when the token is set but the account id is not', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');

    await expect(
      sendEmail({ to: 'a@b.co', message: MESSAGE })
    ).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('when the provider answers after the deadline', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    it('counts the email as sent instead of failing the caller', async () => {
      answerAfter(EMAIL_SEND_TIMEOUT_MS + 3000, () =>
        apiResponse(200, sent({ delivered: ['a@b.co'] }))
      );

      const result = sendEmail({ to: 'a@b.co', message: MESSAGE });
      await vi.advanceTimersByTimeAsync(EMAIL_SEND_TIMEOUT_MS);

      await expect(result).resolves.toEqual({ id: null, skipped: false });
      expect(warnLog).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(3000);
      expect(errorLog).not.toHaveBeenCalled();
    });

    it('logs a send that fails after the deadline', async () => {
      answerAfter(EMAIL_SEND_TIMEOUT_MS + 3000, () =>
        apiResponse(200, sent({ permanent_bounces: ['a@b.co'] }))
      );

      const result = sendEmail({ to: 'a@b.co', message: MESSAGE });
      await vi.advanceTimersByTimeAsync(EMAIL_SEND_TIMEOUT_MS);
      await expect(result).resolves.toEqual({ id: null, skipped: false });

      await vi.advanceTimersByTimeAsync(3000);
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringContaining('failed after the deadline')
      );
    });

    it('waits out a slow answer that lands before the deadline', async () => {
      answerAfter(EMAIL_SEND_TIMEOUT_MS - 500, () =>
        apiResponse(200, sent({ queued: ['a@b.co'] }))
      );

      const result = sendEmail({ to: 'a@b.co', message: MESSAGE });
      await vi.advanceTimersByTimeAsync(EMAIL_SEND_TIMEOUT_MS - 500);

      await expect(result).resolves.toEqual({
        id: '<abc@mail.kallo.fit>',
        skipped: false,
      });
      expect(warnLog).not.toHaveBeenCalled();
    });
  });
});
