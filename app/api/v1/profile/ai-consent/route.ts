import type { NextRequest } from 'next/server';
import { setAiProcessingConsent } from '@/lib/actions/privacy/ai-consent';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { aiConsentSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';

/**
 * `PUT /api/v1/profile/ai-consent` — `{ consented: boolean }`. Records or
 * withdraws consent to third-party AI processing; replies with the stored
 * `{ aiProcessingConsentedAt }` (ISO timestamp or null).
 */
export async function PUT(req: NextRequest) {
  try {
    // Authenticate before touching the body (KALLO-08); the action keeps its
    // own check as the authoritative boundary.
    await requireUserId();

    const { consented } = aiConsentSchema.parse(await readJsonBody(req));
    return Response.json(await setAiProcessingConsent(consented));
  } catch (error) {
    return handleRouteError(error);
  }
}
