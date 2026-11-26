'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { AppleLogo } from '@/components/shared/brand-logos';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * "Continue with Apple" — sits above Google, as the iOS `AppleButton` does,
 * and wears the Google button's quiet card-and-hairline style so the two
 * read as one pair.
 *
 * It hands the browser to GoTrue's `/authorize`, which sends it on to Apple
 * with the `com.khoivo.nham.web` Services ID; Apple posts back to Supabase,
 * and Supabase lands on `/auth/callback` with a code like the Google redirect
 * flow does. Apple allows its page inside in-app browsers, so unlike Google
 * this button needs no webview notice.
 */
export function AppleSignInButton() {
  const t = useTranslations('auth.dialog');
  const locale = useLocale();
  const { next } = useAuthDialog();
  const [loading, setLoading] = useState(false);

  // Backing out of Apple's page can restore this page from the back-forward
  // cache with the spinner still on; clear it so the button works again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLoading(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const onClick = async () => {
    setLoading(true);
    const target = next ?? `/${locale}/logging`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo },
      });
      if (!error) return; // The browser is on its way to Apple.
      console.error('[apple-sign-in] signInWithOAuth failed', error);
    } catch (thrown) {
      console.error('[apple-sign-in] signInWithOAuth threw', thrown);
    }
    toast.error(t('appleError'));
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-kallo-border bg-card px-4 py-3 font-medium font-sans-display text-kallo-text text-sm tracking-tight transition-all duration-200 hover:bg-[#FFFCF8] disabled:opacity-60 dark:hover:bg-kallo-track"
    >
      {loading ? (
        <Loader2 className="size-icon-inline animate-spin" aria-hidden="true" />
      ) : (
        <AppleLogo className="h-4 w-4" />
      )}
      {t('continueWithApple')}
    </button>
  );
}
