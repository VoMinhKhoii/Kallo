import type { UserIdentity } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * `POST /api/v1/auth/apple/token` body. Apple's authorization codes are short
 * opaque strings (well under 100 characters today); the cap only keeps a
 * garbage body from being forwarded to Apple.
 */
export const appleTokenLinkBodySchema = z
  .object({
    authorizationCode: z.string().trim().min(1).max(1024),
  })
  .strict();

/**
 * The Apple `sub` of the caller's linked Apple identity, or `null` when the
 * account has none. Supabase keeps the provider's subject in
 * `identity_data.sub`; `id` is the provider id on older GoTrue versions.
 */
export function appleSubjectOf(
  identities: readonly UserIdentity[] | undefined
): string | null {
  const apple = identities?.find((identity) => identity.provider === 'apple');
  if (!apple) return null;
  const sub = apple.identity_data?.sub;
  if (typeof sub === 'string' && sub.length > 0) return sub;
  return apple.id || null;
}
