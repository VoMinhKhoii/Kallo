import { getTranslations } from 'next-intl/server';
import { Errors } from '@/lib/core/errors/catalog';
import {
  type AiConsentSubject,
  hasAiConsent,
} from '@/lib/domain/privacy/ai-consent';

/**
 * Return a pre-stream 403 `ai_consent_required` when the user has not agreed
 * to send their meal text to the AI provider (App Store 5.1.2(i)).
 *
 * Same shape as the billing 402 beside it, built by hand for the same reason:
 * the route streams, so it answers pre-stream failures with a Response rather
 * than a throw. Runs BEFORE the billing check — a paywall is the wrong answer
 * to a user who has not agreed to the processing the plan would pay for.
 */
export async function getAiConsentError(
  profile: AiConsentSubject,
  locale: string
): Promise<Response | null> {
  if (hasAiConsent(profile)) return null;

  const t = await getTranslations({ locale, namespace: 'errors' });
  return Response.json(
    Errors.aiConsentRequired(t('aiConsentRequired')).toJSON(),
    { status: 403 }
  );
}
