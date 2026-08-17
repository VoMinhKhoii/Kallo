'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { WebviewGoogleNotice } from '@/components/auth/webview-google-notice';
import { GoogleLogo } from '@/components/shared/brand-logos';
import { useGoogleIdentity } from '@/hooks/auth/use-google-identity';
import { useIsInAppBrowser } from '@/hooks/ui/use-in-app-browser';
import { isInAppBrowser } from '@/lib/infra/platform/in-app-browser';
import { createClient } from '@/lib/infra/supabase/client';

export function GoogleSignInButton() {
  const t = useTranslations('auth.dialog');
  const locale = useLocale();
  const { next } = useAuthDialog();
  // Client-only (resolves after hydration): in-app browsers block Google OAuth,
  // so we swap the button for a notice that routes users to a real browser.
  const inApp = useIsInAppBrowser();
  // Google Identity Services: mints the ID token on our own origin, so the
  // account picker is labelled kallo.fit instead of the Supabase project
  // domain. Falls back to the redirect flow whenever GIS can't run.
  const { containerRef, loading, setLoading, signIn } = useGoogleIdentity();

  /**
   * The original flow: hand the browser to GoTrue's `/authorize`. Still the
   * only path when GIS is blocked or unconfigured — it signs the user in fine,
   * it just shows `<project-ref>.supabase.co` on the consent screen.
   */
  const startRedirectFlow = async () => {
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

  const onClick = async () => {
    // Guard the sub-frame before `inApp` resolves post-hydration: Google blocks
    // OAuth in webviews, so never start the flow there. Runs client-side only;
    // the hook's effect swaps in the notice on the same tick.
    if (isInAppBrowser()) return;
    // GIS opens its picker synchronously inside this click, which is what keeps
    // the popup out of the blocker. Only its failure reaches the redirect.
    if (signIn()) return;
    setLoading(true);
    await startRedirectFlow();
  };

  if (inApp) return <WebviewGoogleNotice />;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-kallo-border bg-white px-4 py-3 font-medium font-sans-display text-kallo-text text-sm tracking-tight transition-all duration-200 hover:bg-[#FFFCF8] disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleLogo className="h-4 w-4" />
        )}
        {t('continueWithGoogle')}
      </button>
      {/*
        Google's own button, laid out over the styled one but fully
        transparent. GIS exposes no way to open the account picker
        programmatically, so the visible button forwards its click here. It
        keeps a real box (GIS won't render into a `display:none` or detached
        node) while `pointer-events-none` lets every click through to the
        control users actually see, which is also the only one in the a11y tree.
      */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-0"
      />
    </div>
  );
}
