'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { FEEDBACK_STATUSES } from '@/lib/admin/feedback-queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { userFeedback } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(FEEDBACK_STATUSES),
});

/** Admin-only: move a feedback row through its triage states. */
export async function updateFeedbackStatus(input: {
  id: string;
  status: string;
}): Promise<{ success: true }> {
  await requireAdmin();
  const { id, status } = updateSchema.parse(input);

  // `updated_at` is refreshed by the on_user_feedback_updated trigger, but we
  // also set it here so the value is correct even if the trigger is ever
  // dropped. `.returning()` proves the row existed — a bad id is a real error,
  // not a silent no-op.
  const updated = await db
    .update(userFeedback)
    .set({ status, updatedAt: new Date() })
    .where(eq(userFeedback.id, id))
    .returning({ id: userFeedback.id });

  if (updated.length === 0) {
    throw Errors.notFound('Feedback not found.');
  }

  revalidatePath(`/admin/feedback/${id}`);
  revalidatePath('/admin/feedback');
  return { success: true };
}
