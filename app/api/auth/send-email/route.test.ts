import { createHmac } from 'node:crypto';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import { Errors } from '@/lib/errors/catalog';

type SendEmailFn = typeof import('@/lib/email/send').sendEmail;

const { handleSendEmailHook } = await import('@/app/api/auth/send-email/route');

const SECRET_BYTES = Buffer.from('kallo-send-email-hook-secret').toString(
  'base64'
);
const SECRET = `v1,whsec_${SECRET_BYTES}`;
const NOW = new Date('2026-07-30T12:00:00.000Z');
const WEBHOOK_ID = 'msg_test_1';

interface PayloadOverrides {
  user?: Record<string, unknown>;
  email_data?: Record<string, unknown>;
}

function payload(overrides: PayloadOverrides = {}) {
  return {
    user: { email: 'nguyen@example.com', ...overrides.user },
    email_data: {
      token: '305805',
      token_hash: 'hash_abc',
      token_new: '',
      token_hash_new: '',
      redirect_to: 'https://kallo.fit/auth/callback?next=%2Fvi%2Flogging',
      email_action_type: 'signup',
      site_url: 'https://kallo.fit',
      ...overrides.email_data,
    },
  };
}

function signedRequest(
  body: unknown,
  options?: { secret?: string; timestamp?: number; signature?: string }
) {
  const raw = JSON.stringify(body);
  const timestamp = String(
    options?.timestamp ?? Math.floor(NOW.getTime() / 1000)
  );
  const digest = createHmac(
    'sha256',
    Buffer.from(options?.secret ?? SECRET_BYTES, 'base64')
  )
    .update(`${WEBHOOK_ID}.${timestamp}.${raw}`)
    .digest('base64');

  return new Request('https://kallo.fit/api/auth/send-email', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      'webhook-id': WEBHOOK_ID,
      'webhook-timestamp': timestamp,
      'webhook-signature': options?.signature ?? `v1,${digest}`,
    },
  });
}

let sendEmail: Mock<SendEmailFn>;

function run(body: unknown, options?: Parameters<typeof signedRequest>[1]) {
  return handleSendEmailHook(signedRequest(body, options), {
    sendEmail,
    now: () => NOW,
  });
}

/** The single `to`/link pair a one-email action produced. */
function sentLink(call = 0) {
  const arg = sendEmail.mock.calls[call][0];
  const match = arg.message.text.match(
    /https:\/\/kallo\.fit\/auth\/verify\?[^\s]*/
  );
  return { to: arg.to, url: new URL(match?.[0] ?? ''), tags: arg.tags };
}

describe('handleSendEmailHook', () => {
  beforeEach(() => {
    sendEmail = vi
      .fn<SendEmailFn>()
      .mockResolvedValue({ id: 'email_1', skipped: false });
    vi.stubEnv('SEND_EMAIL_HOOK_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('authentication', () => {
    it('rejects an unsigned request', async () => {
      const request = new Request('https://kallo.fit/api/auth/send-email', {
        method: 'POST',
        body: JSON.stringify(payload()),
      });
      const res = await handleSendEmailHook(request, {
        sendEmail,
        now: () => NOW,
      });

      expect(res.status).toBe(401);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('rejects a signature made with the wrong secret', async () => {
      const res = await run(payload(), {
        secret: Buffer.from('not-the-secret').toString('base64'),
      });

      expect(res.status).toBe(401);
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('fails retryably when the hook secret is not configured', async () => {
      vi.stubEnv('SEND_EMAIL_HOOK_SECRET', '');
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await run(payload());

      expect(res.status).toBe(503);
    });
  });

  describe('link shape', () => {
    it('maps signup to type=email and preserves the locale-prefixed next', async () => {
      const res = await run(payload());

      expect(res.status).toBe(200);
      const { to, url, tags } = sentLink();
      expect(to).toBe('nguyen@example.com');
      expect(url.pathname).toBe('/auth/verify');
      expect(url.searchParams.get('type')).toBe('email');
      expect(url.searchParams.get('token_hash')).toBe('hash_abc');
      expect(url.searchParams.get('next')).toBe('/vi/logging');
      expect(tags).toEqual([{ name: 'kind', value: 'signup' }]);
    });

    it('does not leak the OTP into a link email', async () => {
      await run(payload());

      expect(sendEmail.mock.calls[0][0].message.text).not.toContain('305805');
    });

    it.each([
      ['magiclink', 'email'],
      ['email', 'email'],
      ['invite', 'email'],
      ['recovery', 'recovery'],
    ])('maps %s to type=%s', async (action, expected) => {
      await run(payload({ email_data: { email_action_type: action } }));

      expect(sentLink().url.searchParams.get('type')).toBe(expected);
    });

    it('never emits a type app/auth/verify would reject', async () => {
      for (const action of [
        'signup',
        'magiclink',
        'email',
        'invite',
        'recovery',
        'email_change',
      ]) {
        sendEmail.mockClear();
        await run(
          payload({
            user: { email: 'a@b.co', new_email: 'c@d.co' },
            email_data: {
              email_action_type: action,
              token_hash_new: 'hash_current',
            },
          })
        );
        for (let i = 0; i < sendEmail.mock.calls.length; i++) {
          expect(['email', 'recovery', 'email_change']).toContain(
            sentLink(i).url.searchParams.get('type')
          );
        }
      }
    });

    it('drops an unsafe next instead of forwarding an open redirect', async () => {
      await run(
        payload({
          email_data: {
            redirect_to:
              'https://kallo.fit/auth/callback?next=https%3A%2F%2Fevil.example',
          },
        })
      );

      expect(sentLink().url.searchParams.get('next')).toBeNull();
    });
  });

  describe('localisation', () => {
    it('uses Vietnamese when the redirect carries a /vi path', async () => {
      await run(payload());

      expect(sendEmail.mock.calls[0][0].message.html).toContain(
        '<html lang="vi"'
      );
    });

    it('falls back to English when the redirect carries no locale', async () => {
      await run(
        payload({
          email_data: { redirect_to: 'https://kallo.fit/auth/callback' },
        })
      );

      expect(sendEmail.mock.calls[0][0].message.html).toContain(
        '<html lang="en"'
      );
    });
  });

  describe('email change', () => {
    it('sends the new address token_hash and the current address token_hash_new', async () => {
      await run(
        payload({
          user: { email: 'old@example.com', new_email: 'new@example.com' },
          email_data: {
            email_action_type: 'email_change',
            token_hash: 'hash_for_new',
            token_hash_new: 'hash_for_current',
          },
        })
      );

      expect(sendEmail).toHaveBeenCalledTimes(2);
      const first = sentLink(0);
      const second = sentLink(1);
      expect(first.to).toBe('new@example.com');
      expect(first.url.searchParams.get('token_hash')).toBe('hash_for_new');
      expect(second.to).toBe('old@example.com');
      expect(second.url.searchParams.get('token_hash')).toBe(
        'hash_for_current'
      );
    });

    it.each([
      'email_change_new',
      'email_change_current',
    ])('routes the legacy %s action through the same path', async (action) => {
      await run(
        payload({
          user: { email: 'old@example.com', new_email: 'new@example.com' },
          email_data: {
            email_action_type: action,
            token_hash: 'hash_for_new',
            token_hash_new: 'hash_for_current',
          },
        })
      );

      expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    it('sends a single email when only one token pair is present', async () => {
      await run(
        payload({
          user: { email: 'old@example.com', new_email: 'new@example.com' },
          email_data: {
            email_action_type: 'email_change',
            token_hash: 'hash_for_new',
          },
        })
      );

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sentLink().to).toBe('new@example.com');
    });

    it('gives each of the two emails its own idempotency key', async () => {
      await run(
        payload({
          user: { email: 'old@example.com', new_email: 'new@example.com' },
          email_data: {
            email_action_type: 'email_change',
            token_hash: 'a',
            token_hash_new: 'b',
          },
        })
      );

      const keys = sendEmail.mock.calls.map((c) => c[0].idempotencyKey);
      expect(new Set(keys).size).toBe(2);
      expect(keys[0]).toContain(WEBHOOK_ID);
    });
  });

  describe('other actions', () => {
    it('sends a code-only email for reauthentication', async () => {
      await run(
        payload({ email_data: { email_action_type: 'reauthentication' } })
      );

      const message = sendEmail.mock.calls[0][0].message;
      expect(message.text).toContain('305805');
      expect(message.text).not.toContain('/auth/verify');
    });

    it('accepts and quietly skips notification-only actions', async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await run(
        payload({
          email_data: { email_action_type: 'password_changed_notification' },
        })
      );

      expect(res.status).toBe(200);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('logs an error when an unknown action leaves a user without mail', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await run(
        payload({ email_data: { email_action_type: 'some_future_action' } })
      );

      expect(res.status).toBe(200);
      expect(error).toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('accepts the blank-string fields GoTrue sends on an ordinary signup', async () => {
      // GoTrue fills unused slots with "" rather than omitting them; treating
      // those as invalid emails would 400 every confirmation.
      const res = await run(
        payload({
          user: { new_email: '' },
          email_data: { old_email: '', old_phone: '', provider: '' },
        })
      );

      expect(res.status).toBe(200);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sentLink().to).toBe('nguyen@example.com');
    });

    it('rejects a payload missing email_data', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await run({ user: { email: 'a@b.co' } });

      expect(res.status).toBe(400);
    });

    it('reports a throttled provider as retryable (503), not a client error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      sendEmail.mockRejectedValue(Errors.rateLimited());

      const res = await run(payload());

      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: { http_code: 503 } });
    });

    it('reports a permanent send failure as 500', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      sendEmail.mockRejectedValue(Errors.validationFailed('bad sender'));

      const res = await run(payload());

      expect(res.status).toBe(500);
    });
  });
});
