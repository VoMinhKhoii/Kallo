// ---------------------------------------------------------------------------
// Shared auth guard for app/api/v1/* routes
// ---------------------------------------------------------------------------
// Resolves the authenticated user via the unified Supabase server client
// (Bearer for mobile, cookie for web). Throws a structured AppError that the
// route's serializeError() catch turns into the right HTTP status.

import type { User } from '@supabase/supabase-js';
import { Errors } from '@/lib/core/errors/catalog';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';
import { createClient } from '@/lib/infra/supabase/server';

export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}

/** The full auth user, for the routes that need more than the id (e.g. its
 *  linked identities). */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  return data.user;
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
 * Default ceiling for an `/api/v1` JSON body. The largest legitimate payloads
 * (a 100-row meal edit, a 4000-character feedback message with metadata) stay
 * well under 32 KB; 64 KB leaves headroom without letting one request buffer
 * megabytes. Routes with a different shape pass their own `maxBytes`.
 */
export const DEFAULT_JSON_BODY_MAX_BYTES = 64 * 1024;

/**
 * Parse a request's JSON body under a byte ceiling. A malformed payload is a
 * 400 `VALIDATION_FAILED`, an oversized one a 413 `PAYLOAD_TOO_LARGE` -- both
 * structured, neither retryable. The schema/service-fn validates the shape, so
 * this returns `unknown`.
 *
 * Call it AFTER the route's auth check: an anonymous caller must learn nothing
 * but 401, and must not be able to make the server read and parse a body.
 * (`/api/analyze-meal` is the one deliberate exception: it reads the capped
 * body alongside `getUser()` for latency, and still answers 401 first.)
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = DEFAULT_JSON_BODY_MAX_BYTES
): Promise<unknown> {
  return readBoundedJson(request, maxBytes);
}
