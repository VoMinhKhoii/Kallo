import { withDeadline } from '@/lib/core/async/with-deadline';
import { Errors } from '@/lib/core/errors/catalog';
import { type CloudflareSendResponse, postEmail } from './client';
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
}

export interface SendEmailResult {
  /** Provider message id; null when sending was skipped, or when the
   *  provider had not answered by the deadline. */
  id: string | null;
  /** True when no API token was configured and nothing was actually sent. */
  skipped: boolean;
}

class SendDeadline extends Error {}

/** Statuses worth retrying: throttling and provider-side failures. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/** Why a send failed, or null when Cloudflare took it. */
function failureOf(response: CloudflareSendResponse): string | null {
  if (!response.success) {
    const detail = response.errors.map((e) => `${e.code} ${e.message}`);
    return `HTTP ${response.status}: ${detail.join('; ') || 'no error body'}`;
  }
  if (response.undeliverable.length > 0) {
    return 'refused by the recipient, or the address is on the suppression list';
  }
  return null;
}

/**
 * Send one transactional email through Cloudflare Email Sending.
 *
 * Deliberately forgiving about configuration: with no
 * `CLOUDFLARE_EMAIL_API_TOKEN` the call is a logged no-op rather than a throw,
 * so local dev and the test suite exercise the surrounding flow (sign-up,
 * waitlist) without a provider account or a network round-trip. Every
 * deployed environment sets the token.
 *
 * Failures surface as `AppError`s so `handleRouteError` renders them with the
 * right status, and so the auth hook can tell Supabase which failures are
 * worth retrying.
 *
 * Cloudflare answers only after trying the recipient's mail server: 1–3 s
 * measured, 7 s at worst, against the auth hook's 5 s budget. So at the
 * deadline the email counts as handed over: the request keeps running (the
 * deadline stops waiting, it does not abort, and an aborted request is a
 * cancelled send) and its outcome is logged when it lands.
 */
export async function sendEmail({
  to,
  message,
}: SendEmailInput): Promise<SendEmailResult> {
  if (!emailSendingConfigured()) {
    console.warn(
      `[email] CLOUDFLARE_EMAIL_API_TOKEN unset — skipping "${message.subject}" to ${to}`
    );
    return { id: null, skipped: true };
  }

  const pending = postEmail({
    from: fromAddress(),
    to,
    replyTo: replyToAddress(),
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  let response: CloudflareSendResponse;
  try {
    response = await withDeadline(
      pending,
      EMAIL_SEND_TIMEOUT_MS,
      () => new SendDeadline()
    );
  } catch (cause) {
    if (cause instanceof SendDeadline) {
      console.warn(
        `[email] "${message.subject}" not answered within ${EMAIL_SEND_TIMEOUT_MS} ms; counting it as sent`
      );
      pending.then(
        (late) => {
          const failure = failureOf(late);
          if (failure) {
            console.error(
              `[email] "${message.subject}" failed after the deadline: ${failure}`
            );
          }
        },
        (error: unknown) =>
          console.error(
            `[email] "${message.subject}" failed after the deadline:`,
            error
          )
      );
      return { id: null, skipped: false };
    }
    // Anything else (DNS, socket, missing account id) is a transport failure.
    throw Errors.internal(cause, 'Could not reach the email provider.');
  }

  const failure = failureOf(response);
  if (failure) {
    console.error(`[email] "${message.subject}" failed: ${failure}`);
    if (!response.success && isRetryableStatus(response.status)) {
      throw Errors.rateLimited('Email provider is busy. Please try again.');
    }
    throw Errors.internal(new Error(failure), 'Could not send the email.');
  }

  return { id: response.messageId, skipped: false };
}
