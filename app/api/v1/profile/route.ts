import type { NextRequest } from 'next/server';
import { profileSettingsSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';
import { saveProfileSettings } from '@/lib/domain/onboarding/actions';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    const result = await saveProfileSettings(
      profileSettingsSchema.parse(await req.json())
    );
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
