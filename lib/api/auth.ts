// ---------------------------------------------------------------------------
// Shared auth guard for app/api/v1/* routes
// ---------------------------------------------------------------------------
// Resolves the authenticated user via the unified Supabase server client
// (Bearer for mobile, cookie for web). Throws a structured AppError that the
// route's serializeError() catch turns into the right HTTP status.

import { Errors } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  return data.user.id;
}

/**
 * Like requireUserId, but also pulls the OAuth avatar out of the user's auth
 * metadata (Google puts it in `avatar_url`, some providers in `picture`). Used
 * by the profile route to refresh public_profiles.avatar_url on each app load.
 */
export async function requireUserWithAvatar(): Promise<{
  id: string;
  avatarUrl: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const raw = meta?.avatar_url ?? meta?.picture;
  const avatarUrl = typeof raw === 'string' && raw.length > 0 ? raw : null;
  return { id: data.user.id, avatarUrl };
}

/**
 * Parse a request's JSON body, mapping a malformed payload to a structured
 * validation error (the route's serializeError() catch turns it into a 400).
 * The schema/service-fn validates the shape, so this returns `unknown`.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw Errors.validationFailed('Invalid JSON in request body');
  }
}
