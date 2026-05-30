// ---------------------------------------------------------------------------
// Shared auth guard for /api/v1/groups/* routes
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
