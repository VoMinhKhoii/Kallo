import { type NextRequest, NextResponse } from 'next/server';
import { getFriendshipStatus } from '@/lib/actions/groups/friendship';
import { getProfileBySlug } from '@/lib/actions/groups/profile';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/errors/catalog';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Read-only invite preview for the mobile connect screen. Resolves the inviter
 * from their link slug and reports the viewer's relationship to them WITHOUT
 * mutating anything — the recipient still has to tap Accept (which POSTs to
 * `../accept`). Mirrors the branch logic in `app/[locale]/invite/[slug]/page.tsx`
 * so the app can render the same connect / already / self / invalid / signed-out
 * states.
 *
 * Auth is OPTIONAL here: the web invite page is public, so an anonymous viewer
 * still sees the inviter's public identity (handle + display name only) — they
 * just get `signedOut: true` and the "sign in to connect" CTA instead of Accept.
 *
 * `status`:
 *   - `self`     → the slug is the viewer's own link
 *   - `accepted` → already connected
 *   - `none`     → connectable (show the Accept / sign-in CTA)
 * A blocked edge responds with the same 404 as an invalid slug — the payload
 * never reveals that a block exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const inviter = await getProfileBySlug(slug);
    if (!inviter) {
      throw Errors.notFound('That invite link is invalid.');
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ inviter, status: 'none', signedOut: true });
    }

    let status: 'self' | 'accepted' | 'none';
    if (user.id === inviter.userId) {
      status = 'self';
    } else {
      const friendship = await getFriendshipStatus(user.id, inviter.userId);
      // A blocked edge is surfaced as the SAME 404 an invalid slug gets —
      // the response must never reveal that a block exists.
      if (friendship === 'blocked') {
        throw Errors.notFound('That invite link is invalid.');
      }
      status = friendship === 'accepted' ? 'accepted' : 'none';
    }

    return NextResponse.json({ inviter, status, signedOut: false });
  } catch (error) {
    return handleRouteError(error);
  }
}
