'use server';

import { eq } from 'drizzle-orm';
import { requireUserId } from '@/lib/api/auth';
import { reminderPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';

/**
 * The meal-reminder switch (Settings, web and iOS). Off stops every reminder
 * from the next tick on; nothing else about notifications changes.
 */
export async function setMealReminders(enabled: boolean) {
  // Server Actions are network entry points — the TypeScript signature doesn't
  // validate what a direct caller actually sends.
  const { mealReminders } = reminderPreferencesSchema.parse({
    mealReminders: enabled,
  });
  const userId = await requireUserId();

  const updated = await db
    .update(userProfiles)
    .set({ mealRemindersEnabled: mealReminders })
    .where(eq(userProfiles.userId, userId))
    .returning({ userId: userProfiles.userId });
  if (updated.length === 0) {
    throw new Error('Profile not found');
  }
  return { mealReminders };
}
