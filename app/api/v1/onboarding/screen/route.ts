import type { NextRequest } from 'next/server';
import { onboardingScreenSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';
import { saveOnboardingScreen } from '@/lib/domain/onboarding/actions';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { step, data } = onboardingScreenSchema.parse(await req.json());
    const result = await saveOnboardingScreen(step, data);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
