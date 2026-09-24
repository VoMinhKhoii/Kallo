import type { NextRequest } from 'next/server';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { onboardingScreenSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireUserId();

    const { step, data, advance } = onboardingScreenSchema.parse(
      await readJsonBody(req)
    );
    const result = await saveOnboardingScreen(step, data, {
      advance: advance ?? true,
    });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
