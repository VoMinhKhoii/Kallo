import type { NextRequest } from 'next/server';
import { setAutoShareToCircle } from '@/lib/actions/visibility/sharing-preferences';
import { readJsonBody } from '@/lib/api/auth';
import { sharingPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
    // Auth lives in the action (mirrors PUT /api/v1/profile) — no separate
    // route-level check to keep a single authentication boundary.
    const { autoShareToCircle } = sharingPreferencesSchema.parse(
      await readJsonBody(req)
    );
    await setAutoShareToCircle(autoShareToCircle);
    return Response.json({ autoShareToCircle });
  } catch (error) {
    return handleRouteError(error);
  }
}
