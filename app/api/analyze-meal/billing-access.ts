import { getTranslations } from 'next-intl/server';
import { getBillingConfig } from '@/lib/entitlements/config';
import { checkFeatureAccess } from '@/lib/entitlements/service';
import type { FeatureLockedReason } from '@/lib/errors/app-error';
import { Errors } from '@/lib/errors/catalog';

interface BillingAccessInput {
  locale: string;
  profileCreatedAt: Date;
  userId: string;
}

/** Return a pre-stream 402 when AI analysis is not available to this user. */
export async function getBillingAccessError({
  locale,
  profileCreatedAt,
  userId,
}: BillingAccessInput): Promise<Response | null> {
  if (!getBillingConfig().enforcementEnabled) return null;

  const access = await checkFeatureAccess(
    { userId, profileCreatedAt },
    'ai_analysis'
  );
  if (access.allowed) return null;

  const t = await getTranslations({ locale, namespace: 'errors' });
  const reason: FeatureLockedReason =
    access.reason === 'trial_expired' ? 'trial_expired' : 'not_entitled';
  const messageKey =
    reason === 'trial_expired'
      ? 'featureLockedTrialExpired'
      : 'featureLockedNotEntitled';

  return Response.json(
    Errors.featureLocked('ai_analysis', reason, t(messageKey)).toJSON(),
    { status: 402 }
  );
}
