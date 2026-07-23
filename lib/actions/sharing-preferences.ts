'use server';

import { eq } from 'drizzle-orm';
import { sharingPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function setAutoShareToCircle(enabled: boolean) {
  // Server Actions are network entry points — the TypeScript signature doesn't
  // validate what a direct caller actually sends.
  const { autoShareToCircle } = sharingPreferencesSchema.parse({
    autoShareToCircle: enabled,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Errors.notAuthenticated();

  const updated = await db
    .update(userProfiles)
    .set({ autoShareToCircle })
    .where(eq(userProfiles.userId, user.id))
    .returning({ userId: userProfiles.userId });

  if (updated.length === 0) {
    throw new Error('Profile not found');
  }
}
