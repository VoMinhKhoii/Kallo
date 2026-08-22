/**
 * Addressing + budget constants for every outbound email.
 *
 * The sender lives on a dedicated subdomain (`mail.kallo.fit` by default)
 * rather than the apex: Cloudflare Email Routing already owns the apex SPF
 * record for inbound `support@kallo.fit`, and a second `include:` on the same
 * record is the classic way to silently break both (see
 * docs/PROD_DOMAIN_SETUP.md §7). Replies still go to the human inbox.
 */

/** Fallbacks keep local dev working with nothing configured. */
const DEFAULT_FROM = 'Kallo <notifications@mail.kallo.fit>';
const DEFAULT_REPLY_TO = 'support@kallo.fit';

/**
 * Wall-clock budget for a single provider call. Supabase runs auth hooks
 * inside the sign-up transaction and gives them only a few seconds, so a
 * stalled Resend request must surface as a retryable error rather than
 * wedging the user's sign-up.
 */
export const EMAIL_SEND_TIMEOUT_MS = 4000;

export function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export function replyToAddress(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || DEFAULT_REPLY_TO;
}

/** True when a real provider call can be made; false in local dev / tests. */
export function emailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
