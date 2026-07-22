import type { NextRequest } from 'next/server';
import { setAutoShareToCircle } from '@/lib/actions/sharing-preferences';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { sharingPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  try {
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
