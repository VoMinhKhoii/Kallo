'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import {
  type GrantPremiumInput,
  grantPremiumInputSchema,
} from '@/lib/admin/premium/grant-input';
import { grantPremium } from '@/lib/admin/premium/grant-premium';
import { isAppError } from '@/lib/core/errors/app-error';
import { db } from '@/lib/infra/db/client';

export type GrantPremiumActionResult =
  | { success: true; userCount: number; expiresAt: string }
  | { success: false; error: string };

/**
 * Admin-only: give complimentary Premium to named accounts or to everyone.
 *
 * The admin check runs HERE, not just in the /admin layout — a server action
 * is a public POST endpoint that anyone can call without rendering the page.
 * A non-admin gets the same 404 the layout gives them.
 */
export async function grantPremiumAction(
  input: GrantPremiumInput
): Promise<GrantPremiumActionResult> {
  const admin = await requireAdmin();

  const parsed = grantPremiumInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  try {
    const result = await grantPremium(admin, parsed.data, { db });
    console.info(
      `[admin] ${admin.email} granted Premium: scope=${parsed.data.scope} days=${parsed.data.days} users=${result.userCount} audit=${result.auditId}`
    );
    revalidatePath('/[locale]/admin/premium', 'page');
    return {
      success: true,
      userCount: result.userCount,
      expiresAt: result.expiresAt.toISOString(),
    };
  } catch (error) {
    if (isAppError(error) && error.status === 400) {
      return { success: false, error: error.userMessage };
    }
    console.error('[admin] grantPremiumAction failed', error);
    return { success: false, error: 'Could not grant Premium. Try again.' };
  }
}
