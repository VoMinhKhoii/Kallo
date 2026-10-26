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
 * How long `sendEmail` waits for the provider's answer. Supabase gives the
 * auth hook 5 s for the whole invocation, so past this point the send is
 * left running and counted as sent rather than wedging the user's sign-up.
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
  return Boolean(process.env.CLOUDFLARE_EMAIL_API_TOKEN);
}
