'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
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

/**
 * Sign out for the desktop user menu and the mobile account sheet.
 *
 * A failure keeps the user where they are with a toast and re-enables the
 * control; success never resets `signingOut`, because the page is leaving.
 */
export function useSignOut() {
  const t = useTranslations('app.userMenu');
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutThisBrowser();
    } catch (error) {
      console.error('Failed to sign out:', error);
      toast.error(t('signOutError'));
      setSigningOut(false);
    }
  };

  return { signOut, signingOut };
}
