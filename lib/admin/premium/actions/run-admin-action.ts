import 'server-only';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { type AdminUser, requireAdmin } from '@/lib/admin/authz/require-admin';
import { isAppError } from '@/lib/core/errors/app-error';

export type ActionOutcome<T> =
  | ({ success: true } & T)
  | { success: false; error: string };

/**
 * The shared shape of every /admin/premium server action. A server action is
 * a public POST endpoint, so the admin check runs HERE, before anything is
 * parsed or touched — a non-admin gets the same 404 the layout gives them.
 * Input is parsed with the action's zod schema; validation and 400s come back
 * as the form's message, anything else as a generic one (logged).
 */
export async function runAdminAction<S extends z.ZodType, T>(
  label: string,
  schema: S,
  input: unknown,
  run: (admin: AdminUser, parsed: z.output<S>) => Promise<T>,
  // Reads (search, preview) neither log nor refresh the admin pages.
  { mutates = true }: { mutates?: boolean } = {}
): Promise<ActionOutcome<T>> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }
  try {
    const result = await run(admin, parsed.data);
    if (mutates) {
      console.info(`[admin] ${admin.email} ${label}`);
      revalidatePath('/[locale]/admin/premium', 'layout');
    }
    return { success: true, ...result };
  } catch (error) {
    if (isAppError(error) && error.status === 400) {
      return { success: false, error: error.userMessage };
    }
    console.error(`[admin] ${label} failed`, error);
    return { success: false, error: 'Something went wrong. Try again.' };
  }
}
