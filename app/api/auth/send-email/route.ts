import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  type AuthEmailPayload,
  authEmailPayloadSchema,
  resolveAuthEmails,
} from '@/lib/email/auth-email';
import { sendEmail as defaultSendEmail } from '@/lib/email/send';
import { isAppError } from '@/lib/errors/app-error';
import {
  readSignatureHeaders,
  verifyStandardWebhook,
} from '@/lib/security/standard-webhooks';
import {
  readBoundedWebhookBody,
  WebhookPayloadTooLargeError,
} from '@/lib/security/webhook-request';

export const runtime = 'nodejs';

/**
 * Supabase "Send Email" auth hook.
 *
 * With this hook enabled, GoTrue stops sending auth email entirely and posts
 * the payload here instead, so every confirmation, magic link, recovery and
 * email-change message is composed by us (bilingual, branded, versioned in this
 * repo) and delivered by Resend.
 *
 * Three things make this route unusual:
 *
 * 1. **It runs inside the sign-up transaction.** Supabase gives HTTP hooks only
 *    a few seconds; a slow send must fail *retryably* rather than hang, hence
 *    the deadline inside `sendEmail`.
 * 2. **Status codes are an API.** Supabase treats 429/503 as retryable and
 *    converts 400/403 into a 500 that is not retried — so a transient Resend
 *    problem must surface as 503, never as a 4xx.
 * 3. **It authenticates itself.** No session exists yet, so the only proof of
 *    origin is the Standard Webhooks signature. The Cloudflare origin-lock in
 *    `middleware.ts` still applies on top (Supabase reaches us through the
 *    public hostname), but the signature is what actually gates this handler.
 */

/** Supabase caps hook payloads at 20KB; allow a little headroom, no more. */
const MAX_HOOK_BYTES = 32 * 1024;

export interface SendEmailHookDeps {
  sendEmail?: typeof defaultSendEmail;
  now?: () => Date;
}

/** Supabase's expected error envelope. `http_code` drives its retry decision. */
function hookError(httpCode: number, message: string) {
  return NextResponse.json(
    { error: { http_code: httpCode, message } },
    { status: httpCode }
  );
}

export async function handleSendEmailHook(
  request: Request,
  deps?: SendEmailHookDeps
): Promise<NextResponse> {
  const send = deps?.sendEmail ?? defaultSendEmail;
  const now = deps?.now?.() ?? new Date();

  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    console.error('[auth/send-email] SEND_EMAIL_HOOK_SECRET is not set.');
    return hookError(503, 'Email hook is not configured.');
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedWebhookBody(request, MAX_HOOK_BYTES);
  } catch (error) {
    if (error instanceof WebhookPayloadTooLargeError) {
      return hookError(413, 'Payload too large.');
    }
    throw error;
  }

  if (
    !verifyStandardWebhook(rawBody, readSignatureHeaders(request), secret, now)
  ) {
    return hookError(401, 'Invalid webhook signature.');
  }

  let payload: AuthEmailPayload;
  try {
    payload = authEmailPayloadSchema.parse(JSON.parse(rawBody));
  } catch (error) {
    const detail =
      error instanceof z.ZodError
        ? (error.issues[0]?.message ?? 'Invalid payload.')
        : 'Malformed JSON body.';
    console.error(`[auth/send-email] rejected payload: ${detail}`);
    return hookError(400, detail);
  }

  const emails = resolveAuthEmails(payload);
  if (emails.length === 0) {
    // Answering 200 lets the underlying auth operation complete instead of
    // failing it over an email. That is correct for GoTrue's courtesy
    // `*_notification` events, and merely the least-bad option for anything
    // else — so anything else is logged as an error, since a user is waiting
    // on a message we just decided not to send.
    const action = payload.email_data.email_action_type;
    const log = action.endsWith('_notification') ? console.info : console.error;
    log(`[auth/send-email] no template for "${action}" — nothing sent`);
    return new NextResponse(null, { status: 200 });
  }

  // Scope the idempotency key per email so the two-message email-change flow
  // doesn't collapse into one send on a Supabase retry.
  const webhookId = request.headers.get('webhook-id');

  for (const email of emails) {
    try {
      await send({
        to: email.to,
        message: email.message,
        tags: [{ name: 'kind', value: email.kind }],
        ...(webhookId ? { idempotencyKey: `${webhookId}:${email.kind}` } : {}),
      });
    } catch (error) {
      const retryable = isAppError(error) && error.retryable;
      console.error(
        `[auth/send-email] failed to send "${email.kind}":`,
        error instanceof Error ? error.message : error
      );
      return retryable
        ? hookError(503, 'Email provider is unavailable. Please retry.')
        : hookError(500, 'Could not send the email.');
    }
  }

  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  return handleSendEmailHook(request);
}
