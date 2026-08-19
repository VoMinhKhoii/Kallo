import 'server-only';
import { getAdminEmailSet } from '@/lib/admin/authz/admin-emails';

/**
 * Non-throwing admin check. Returns true when the email is configured in
 * ADMIN_EMAILS. Use for UI gating (e.g. showing the Admin sidebar item) —
 * for hard route guards keep using `requireAdmin()`.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = getAdminEmailSet();
  if (allow.size === 0) return false;
  return allow.has(email.toLowerCase());
}
