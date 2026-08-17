'use server';

import { eq } from 'drizzle-orm';
import { sharingPreferencesSchema } from '@/lib/api/contracts/onboarding';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { userProfiles } from '@/lib/infra/db/schema';
import { createClient } from '@/lib/infra/supabase/server';

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
