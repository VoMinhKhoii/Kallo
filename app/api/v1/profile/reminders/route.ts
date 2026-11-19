import type { NextRequest } from 'next/server';
import { setMealReminders } from '@/lib/actions/notifications/reminder-preferences';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { reminderPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { handleRouteError } from '@/lib/api/respond';

export async function PUT(req: NextRequest) {
  try {
    // Authenticate before touching the body (KALLO-08); the action keeps its
    // own check as the authoritative boundary.
    await requireUserId();

    const { mealReminders } = reminderPreferencesSchema.parse(
      await readJsonBody(req)
    );
    return Response.json(await setMealReminders(mealReminders));
  } catch (error) {
    return handleRouteError(error);
  }
}
