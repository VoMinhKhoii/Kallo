import { z } from 'zod';
import type { ErrorCode } from '@/lib/core/errors/codes';

/**
 * How the analyze endpoint refused before its stream opened, as the client
 * needs to act on it. Flutter twin: `classifyPreStreamRefusal` in
 * `apps/mobile-flutter/lib/models/logging/streaming.dart`.
 *
 *   - `paymentRequired` — HTTP 402: AI analysis is locked; open the paywall.
 *   - `consentRequired` — the body says `ai_consent_required`: no AI-processing
 *     consent on record; ask for it.
 *   - `error`           — anything else, including a 403 with no such code.
 *
 * Consent is read from the body code and never from the status alone: the
 * origin lock in `proxy.ts`, a WAF or Cloud Run can all answer a bare 403, and
 * treating those as "ask for consent" opens the dialog on a refusal that
 * consent cannot fix — and re-opens it on every retry.
 */
export type PreStreamRefusal = 'paymentRequired' | 'consentRequired' | 'error';

const CONSENT_CODE: ErrorCode = 'ai_consent_required';

// The structured envelope `{ error: { code, message } }` or the legacy
// `{ error: "message" }`. Anything else (an HTML page from a proxy, no body at
// all) parses as neither and falls through to the generic message.
const refusalBodySchema = z.object({
  error: z.union([
    z.string(),
    z.object({ code: z.string().optional(), message: z.string().optional() }),
  ]),
});

function parseBody(body: unknown) {
  const parsed = refusalBodySchema.safeParse(body);
  return parsed.success ? parsed.data.error : null;
}

export function classifyPreStreamRefusal(
  status: number,
  body: unknown
): PreStreamRefusal {
  // Keyed on the status alone, as it always was: the body of a 402 (code
  // 'feature_locked', feature, reason) is informative, not authoritative.
  if (status === 402) return 'paymentRequired';
  const error = parseBody(body);
  if (typeof error === 'object' && error?.code === CONSENT_CODE) {
    return 'consentRequired';
  }
  return 'error';
}

/** The message a pre-stream refusal carries, whichever envelope it came in. */
export function preStreamErrorMessage(status: number, body: unknown): string {
  const error = parseBody(body);
  if (typeof error === 'string') return error;
  return error?.message ?? `Request failed (${status})`;
}
