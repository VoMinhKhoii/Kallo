import type { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { getOnboardingProfile } from '@/lib/domain/onboarding/actions';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const result = await getOnboardingProfile();
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
