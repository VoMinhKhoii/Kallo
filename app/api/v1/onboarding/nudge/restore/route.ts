import type { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { restoreOnboardingNudge } from '@/lib/onboarding/actions';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const result = await restoreOnboardingNudge();
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
