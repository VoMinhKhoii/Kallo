import { withDeadline } from '@/lib/core/async/with-deadline';
import { AppError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { resendClient } from './client';
import {
  EMAIL_SEND_TIMEOUT_MS,
  emailSendingConfigured,
  fromAddress,
  replyToAddress,
} from './config';

/** What every template in lib/email/templates returns. */
export interface EmailMessage {
  subject: string;
  html: string;
  /** Plain-text alternative — required, not optional: a missing text/plain
   *  part is one of the strongest spam signals there is. */
  text: string;
}

export interface SendEmailInput {
  to: string;
  message: EmailMessage;
  /** Resend tags for dashboard filtering (e.g. `[{name:'kind',value:'signup'}]`).
   *  Resend only accepts ASCII letters, digits, `_` and `-` in tag values. */
  tags?: { name: string; value: string }[];
  /** Dedupe key. The auth hook passes the Standard Webhooks `webhook-id` so a
   *  Supabase retry after a slow-but-successful send doesn't double-deliver. */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  /** Provider message id, or null when sending was skipped. */
  id: string | null;
  /** True when no API key was configured and nothing was actually sent. */
  skipped: boolean;
}

/** Resend statuses worth retrying: throttling and provider-side failures. */
function isRetryableStatus(status: number | null): boolean {
  return status === 429 || status === 408 || (status !== null && status >= 500);
}

/**
 * Send one transactional email through Resend.
 *
 * Deliberately forgiving about configuration: with no `RESEND_API_KEY` the
 * call is a logged no-op rather than a throw, so local dev and the test suite
 * exercise the surrounding flow (sign-up, waitlist) without a provider account
 * or a network round-trip. Every deployed environment sets the key.
 *
 * Failures surface as `AppError`s so `handleRouteError` renders them with the
 * right status, and so the auth hook can tell Supabase which failures are
 * worth retrying.
 */
export async function sendEmail({
  to,
  message,
  tags,
  idempotencyKey,
}: SendEmailInput): Promise<SendEmailResult> {
  if (!emailSendingConfigured()) {
    console.warn(
      `[email] RESEND_API_KEY unset — skipping "${message.subject}" to ${to}`
    );
    return { id: null, skipped: true };
  }

  const send = () =>
    resendClient().emails.send(
      {
        from: fromAddress(),
        to,
        replyTo: replyToAddress(),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(tags ? { tags } : {}),
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );

  let response: Awaited<ReturnType<typeof send>>;
  try {
    response = await withDeadline(send(), EMAIL_SEND_TIMEOUT_MS, () =>
      Errors.rateLimited('Email provider timed out. Please try again.')
    );
  } catch (cause) {
    // The deadline error is already an AppError; anything else (DNS, socket)
    // is a transport failure, which is worth a retry.
    if (cause instanceof AppError) throw cause;
    throw Errors.internal(cause, 'Could not reach the email provider.');
  }

  if (response.error) {
    const { name, message: detail, statusCode } = response.error;
    console.error(`[email] send failed (${name}): ${detail}`);
    if (isRetryableStatus(statusCode)) {
      throw Errors.rateLimited('Email provider is busy. Please try again.');
    }
    throw Errors.internal(response.error, 'Could not send the email.');
  }

  return { id: response.data?.id ?? null, skipped: false };
}
