'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { WebviewGoogleNotice } from '@/components/auth/webview-google-notice';
import { GoogleLogo } from '@/components/shared/brand-logos';
import { useIsInAppBrowser } from '@/hooks/ui/use-in-app-browser';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';

export function GoogleSignInButton() {
  const t = useTranslations('auth.dialog');
  const locale = useLocale();
  const { next } = useAuthDialog();
  const [loading, setLoading] = useState(false);
  // Client-only (resolves after hydration): in-app browsers block Google OAuth,
  // so we swap the button for a notice that routes users to a real browser.
  const inApp = useIsInAppBrowser();

  const onClick = async () => {
    // Guard the sub-frame before `inApp` resolves post-hydration: Google blocks
    // OAuth in webviews, so never start the flow there. Runs client-side only;
    // the hook's effect swaps in the notice on the same tick.
    if (isInAppBrowser()) return;
    setLoading(true);
    const supabase = createClient();
    // Prefer the invite return-path when present; otherwise land in the app.
    const target = next ?? `/${locale}/logging`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) {
      console.error('[google-sign-in] signInWithOAuth failed', error);
      toast.error(t('googleError'));
      setLoading(false);
    }
    // On success the browser is redirected to Google; no further work here.
  };

  if (inApp) return <WebviewGoogleNotice />;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-nham-border bg-white px-4 py-3 font-medium font-sans-display text-nham-text text-sm tracking-tight transition-all duration-200 hover:bg-[#FFFCF8] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <GoogleLogo className="h-4 w-4" />
      )}
      {t('continueWithGoogle')}
    </button>
  );
}
