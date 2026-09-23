import type { NextRequest } from 'next/server';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { profileSettingsSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';
import { saveProfileSettings } from '@/lib/domain/onboarding/actions';

export async function PUT(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireUserId();

    const result = await saveProfileSettings(
      profileSettingsSchema.parse(await readJsonBody(req))
    );
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
