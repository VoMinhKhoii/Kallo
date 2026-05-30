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
