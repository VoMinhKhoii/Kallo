import type { NextRequest } from 'next/server';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { onboardingScreenSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireUserId();

    const { step, data } = onboardingScreenSchema.parse(
      await readJsonBody(req)
    );
    const result = await saveOnboardingScreen(step, data);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
