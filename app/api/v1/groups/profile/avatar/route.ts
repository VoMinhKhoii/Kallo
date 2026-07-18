import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { removeMyAvatar, uploadMyAvatar } from '@/lib/actions/groups/avatar';
import { Errors, serializeError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Session client + user id — the avatar upload goes through the user's OWN
 * session storage client so the `avatars_*_own` RLS policies apply. */
async function requireSessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  return { supabase, userId: data.user.id };
}

/**
 * Upload the signed-in user's avatar photo as multipart form-data (field
 * `file`). Returns the updated `{ profile }` with the new `avatarUrl`.
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireSessionUser();
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw Errors.validationFailed('Expected a `file` upload.');
    }
    const profile = await uploadMyAvatar(userId, file, supabase);
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}

/** Remove the avatar photo (the UI falls back to the initials disc). */
export async function DELETE() {
  try {
    const { supabase, userId } = await requireSessionUser();
    const profile = await removeMyAvatar(userId, supabase);
    return NextResponse.json({ profile });
  } catch (error) {
    return serializeError(error);
  }
}
