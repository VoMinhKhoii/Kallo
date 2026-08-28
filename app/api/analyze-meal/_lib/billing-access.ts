import { getTranslations } from 'next-intl/server';
import { Errors } from '@/lib/core/errors/catalog';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';

interface BillingAccessInput {
  locale: string;
  profileCreatedAt: Date;
  userId: string;
}

/**
 * Return a pre-stream 402 when AI analysis is not available to this user.
 *
 * The gating decision itself lives in `checkFeatureGate` (kill-switch first,
 * no DB read when off); this wrapper only exists because the route streams and
 * therefore has to build a localized Response by hand instead of throwing.
 */
export async function getBillingAccessError({
  locale,
  profileCreatedAt,
  userId,
}: BillingAccessInput): Promise<Response | null> {
  const gate = await checkFeatureGate(
    { userId, profileCreatedAt },
    'ai_analysis'
  );
  if (!gate.locked) return null;

  const t = await getTranslations({ locale, namespace: 'errors' });
  const messageKey =
    gate.reason === 'trial_expired'
      ? 'featureLockedTrialExpired'
      : 'featureLockedNotEntitled';

  return Response.json(
    Errors.featureLocked('ai_analysis', gate.reason, t(messageKey)).toJSON(),
    { status: 402 }
  );
}
