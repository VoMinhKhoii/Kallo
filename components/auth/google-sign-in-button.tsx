'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { WebviewGoogleNotice } from '@/components/auth/webview-google-notice';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';

export function GoogleSignInButton() {
  const t = useTranslations('auth.dialog');
  const locale = useLocale();
  const { next } = useAuthDialog();
  const [loading, setLoading] = useState(false);
  // Evaluated once, client-only: in-app browsers block Google OAuth, so we
  // swap the button for a notice that routes users to a real browser.
  const [inApp] = useState(() => isInAppBrowser());

  const onClick = async () => {
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

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}
