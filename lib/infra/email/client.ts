import { z } from 'zod';

/**
 * Cloudflare Email Sending REST client. The API is one POST, so there is no
 * SDK: https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
 *
 * Credentials are read per call rather than at import, so the module stays
 * importable at build time (static page generation, CI) with nothing
 * configured. Callers gate on `emailSendingConfigured()` first.
 */
const API_BASE = 'https://api.cloudflare.com/client/v4';

export interface OutboundEmail {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

// Lenient past `success` on purpose: a field the API sends as null or drops
// must not turn an accepted send into a failure.
const responseSchema = z.object({
  success: z.boolean(),
  errors: z
    .array(z.object({ code: z.number(), message: z.string() }))
    .nullish(),
  result: z
    .object({
      message_id: z.string().nullish(),
      permanent_bounces: z.array(z.string()).nullish(),
      suppressed_recipients: z.array(z.string()).nullish(),
    })
    .nullish(),
});

export interface CloudflareSendResponse {
  status: number;
  /** False on any HTTP error, and when the body is not the API's envelope
   *  (e.g. an HTML error page from the edge). */
  success: boolean;
  errors: { code: number; message: string }[];
  messageId: string | null;
  /** Recipients that will not get the email although the call succeeded: the
   *  receiving server refused it, or the address is on Cloudflare's
   *  suppression list after an earlier bounce or complaint. */
  undeliverable: string[];
}

/**
 * Send one email. Not abortable on purpose: Cloudflare cancels a send whose
 * request is dropped, so a caller that stops waiting must leave it running.
 */
export async function postEmail(
  email: OutboundEmail
): Promise<CloudflareSendResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!accountId || !token) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN must both be set to send email.'
    );
  }

  const response = await fetch(
    `${API_BASE}/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    }
  );

  const parsed = responseSchema.safeParse(
    await response.json().catch(() => null)
  );
  const result = parsed.success ? parsed.data.result : null;
  return {
    status: response.status,
    success: response.ok && parsed.success && parsed.data.success,
    errors: (parsed.success && parsed.data.errors) || [],
    messageId: result?.message_id ?? null,
    undeliverable: [
      ...(result?.permanent_bounces ?? []),
      ...(result?.suppressed_recipients ?? []),
    ],
  };
}
