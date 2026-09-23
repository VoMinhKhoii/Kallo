import { redirect } from 'next/navigation';
import {
  type AuthSearchParams,
  authIntent,
} from '@/components/auth/request-config/auth-request-config';
import { createClient } from '@/lib/infra/supabase/server';

/**
 * A signed-in visitor with no auth/invite intent shouldn't see the marketing
 * page — send them into the app. This is also what makes the installed PWA
 * (whose start_url is /dashboard) never flash the landing page.
 *
 * A leaf rather than the page's first line so the landing page itself stays a
 * prerendered static shell: render it inside `<Suspense fallback={null}>`. The
 * proxy already answers most of these with an HTTP redirect before the page
 * renders (`updateSession`); this is the in-page backstop.
 */
export async function SignedInRedirect({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  if (authIntent(await searchParams).openTab) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect('/dashboard');
  }
  return null;
}
