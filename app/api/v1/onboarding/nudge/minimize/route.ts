import type { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { minimizeOnboardingNudge } from '@/lib/domain/onboarding/actions';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const result = await minimizeOnboardingNudge();
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
