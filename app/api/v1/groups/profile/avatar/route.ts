import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { removeMyAvatar, uploadMyAvatar } from '@/lib/actions/groups/avatar';
import { Errors } from '@/lib/errors/catalog';
import { serializeError } from '@/lib/errors/serialize';
import { createClient } from '@/lib/supabase/server';
import { MAX_IMAGE_BYTES } from '@/lib/uploads/image-file';

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
    // Reject oversized requests before req.formData() buffers the whole body
    // (multipart framing overhead on top of the 5 MB file cap). A missing or
    // non-numeric Content-Length is rejected too — otherwise a chunked upload
    // with no declared length would slip past and buffer unbounded. (The file
    // is still re-validated for real size + magic bytes downstream.)
    const rawLength = req.headers.get('content-length');
    const contentLength = Number(rawLength);
    if (
      rawLength === null ||
      !Number.isFinite(contentLength) ||
      contentLength > MAX_IMAGE_BYTES * 2
    ) {
      throw Errors.validationFailed('Image must be under 5 MB.');
    }
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
