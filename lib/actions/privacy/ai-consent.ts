'use server';

import { eq } from 'drizzle-orm';
import {
  type AiConsentState,
  aiConsentSchema,
} from '@/lib/api/contracts/onboarding';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { createClient } from '@/lib/infra/supabase/server';

/**
 * Record (or withdraw) the user's consent to send meal text and label photos
 * to the third-party AI provider (App Store 5.1.2(i)). Agreeing stamps
 * `ai_processing_consented_at` with the moment of consent; withdrawing clears
 * it, after which every AI entry point refuses with `ai_consent_required`
 * until the user agrees again. Shared by the web settings toggle / consent
 * dialog and `PUT /api/v1/profile/ai-consent`.
 */
export async function setAiProcessingConsent(
  consented: boolean
): Promise<AiConsentState> {
  // Server Actions are network entry points — the TypeScript signature doesn't
  // validate what a direct caller actually sends.
  const parsed = aiConsentSchema.parse({ consented });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Errors.notAuthenticated();

  const consentedAt = parsed.consented ? new Date() : null;
  const updated = await db
    .update(userProfiles)
    .set({ aiProcessingConsentedAt: consentedAt, updatedAt: new Date() })
    .where(eq(userProfiles.userId, user.id))
    .returning({ consentedAt: userProfiles.aiProcessingConsentedAt });

  const row = updated[0];
  if (!row) throw Errors.profileNotFound();

  return { aiProcessingConsentedAt: row.consentedAt?.toISOString() ?? null };
}
