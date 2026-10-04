'use server';

import { z } from 'zod';
import { runAdminAction } from '@/lib/admin/premium/actions/run-admin-action';
import { undoAction } from '@/lib/admin/premium/activity/undo';
import { db } from '@/lib/infra/db/client';

const undoInputSchema = z.object({
  actionId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, 'Say why, in a few words.')
    .max(300, 'Keep the reason under 300 characters.'),
});

/** Admin-only: reverse one earlier action. */
export async function undoAdminAction(input: z.input<typeof undoInputSchema>) {
  return runAdminAction(
    'undid an action',
    undoInputSchema,
    input,
    async (admin, { actionId, reason }) =>
      undoAction(admin, actionId, reason, { db })
  );
}
