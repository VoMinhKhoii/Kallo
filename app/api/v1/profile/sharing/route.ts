import type { NextRequest } from 'next/server';
import { setAutoShareToCircle } from '@/lib/actions/visibility/sharing-preferences';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { sharingPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireUserId();

    const { autoShareToCircle } = sharingPreferencesSchema.parse(
      await readJsonBody(req)
    );
    await setAutoShareToCircle(autoShareToCircle);
    return Response.json({ autoShareToCircle });
  } catch (error) {
    return handleRouteError(error);
  }
}
