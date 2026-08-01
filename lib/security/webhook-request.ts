import { timingSafeEqual } from 'node:crypto';

/**
 * Transport-level helpers shared by every inbound webhook handler
 * (RevenueCat billing events, the Supabase send-email auth hook).
 *
 * Both handlers must read the body as a *string* before parsing, because the
 * signature covers the exact bytes that were sent — re-serialising a parsed
 * object would change whitespace and key order and break verification.
 */

/** Constant-time string compare. Length is allowed to leak; content is not. */
export function timingSafeMatch(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  if (firstBuffer.length !== secondBuffer.length) return false;
  return timingSafeEqual(firstBuffer, secondBuffer);
}

export class WebhookPayloadTooLargeError extends Error {}

/**
 * Read a request body as text, refusing anything over `maxBytes`.
 *
 * Checks `content-length` first (cheap rejection) and then enforces the cap
 * while streaming, so a lying or absent header can't be used to stuff the
 * handler with an unbounded payload.
 */
export async function readBoundedWebhookBody(
  request: Request,
  maxBytes: number
): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > maxBytes
  ) {
    throw new WebhookPayloadTooLargeError();
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let rawBody = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new WebhookPayloadTooLargeError();
    }
    rawBody += decoder.decode(value, { stream: true });
  }

  return rawBody + decoder.decode();
}
