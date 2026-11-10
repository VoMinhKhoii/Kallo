import { clearComposerDrafts } from '@/lib/domain/logging/drafts/composer-drafts';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * Ends this browser's session and hard-navigates home, clearing the composer
 * drafts and the locale cookie. Every web Sign out button goes through here.
 *
 * `local`: only this browser. supabase-js defaults to `global`, which also
 * revokes the iOS app's session on the same account.
 */
export async function signOutThisBrowser() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
  clearComposerDrafts();
  document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax';
  window.location.assign('/');
}
