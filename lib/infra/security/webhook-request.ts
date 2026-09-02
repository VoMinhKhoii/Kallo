import { timingSafeEqual } from 'node:crypto';
import { PayloadTooLargeError } from '@/lib/core/errors/app-error';
import { readBoundedBody } from '@/lib/infra/http/bounded-body';

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
 * Read a webhook body as text, refusing anything over `maxBytes`.
 *
 * A thin adapter over the generic `readBoundedBody` (content-length prefilter
 * plus streaming cap), differing only in what it throws: the two webhook
 * handlers catch `WebhookPayloadTooLargeError` and answer in the SHAPE THEIR
 * PROVIDER EXPECTS, not in our own error envelope, so the generic 413
 * `AppError` must not leak out of here.
 */
export async function readBoundedWebhookBody(
  request: Request,
  maxBytes: number
): Promise<string> {
  try {
    const body = await readBoundedBody(request, maxBytes);
    return new TextDecoder().decode(body);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      throw new WebhookPayloadTooLargeError();
    }
    throw error;
  }
}
