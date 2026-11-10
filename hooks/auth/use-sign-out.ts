'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { signOutThisBrowser } from '@/lib/infra/supabase/sign-out';

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
