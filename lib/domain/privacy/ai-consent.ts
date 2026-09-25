// Consent to third-party AI processing (App Store Guideline 5.1.2(i)).
//
// Every server path that sends user content to the AI provider — meal text to
// analysis, label photos to OCR, a search query to a live embedding call —
// asks this module first. The record is `user_profiles.ai_processing_consented_at`:
// a timestamp when the user agreed through the one-time consent sheet, NULL
// when they never did or withdrew in Settings. The server is the enforcement
// point; the clients only decide when to show the sheet.

import { Errors } from '@/lib/core/errors/catalog';

/** The one profile field the gate reads — any profile row satisfies it. */
export interface AiConsentSubject {
  aiProcessingConsentedAt: Date | null;
}

/**
 * True when this user has agreed to send content to the AI provider. Fails
 * closed: anything but a recorded timestamp — NULL, or a field a partial
 * select left out — counts as no consent.
 */
export function hasAiConsent(profile: AiConsentSubject): boolean {
  return Boolean(profile.aiProcessingConsentedAt);
}

/**
 * Throw the 403 `ai_consent_required` envelope unless the user has consented.
 * For routes that fail through `handleRouteError`; the streaming analysis route
 * serializes the same error by hand because it answers before its stream opens.
 */
export function assertAiConsent(
  profile: AiConsentSubject,
  message?: string
): void {
  if (!hasAiConsent(profile)) throw Errors.aiConsentRequired(message);
}
