'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useIsAndroid } from '@/hooks/ui/use-in-app-browser';
import { chromeIntentUrl } from '@/lib/in-app-browser';

/**
 * Shown in place of the Google button when the app runs inside an in-app
 * browser that blocks Google OAuth ("Error 403: disallowed_useragent"). It
 * explains the limitation and offers escape hatches to a real browser, while
 * the email form below stays fully functional.
 */
export function WebviewGoogleNotice() {
  const t = useTranslations('auth.dialog');
  // Client-only (resolves after hydration) — the Chrome escape is Android-only.
  const android = useIsAndroid();

  const openInChrome = () => {
    window.location.href = chromeIntentUrl(window.location.href);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('webviewLinkCopied'));
    } catch {
      // Clipboard access is often denied inside webviews.
      toast.error(t('webviewCopyError'));
    }
  };

  return (
    <div className="rounded-xl border border-nham-accent/30 bg-nham-accent/10 px-4 py-3">
      <div className="flex gap-2.5">
        <Globe
          className="mt-0.5 h-4 w-4 shrink-0 text-nham-accent"
          aria-hidden="true"
        />
        <div className="space-y-1.5">
          <p className="font-medium font-sans-display text-nham-text text-sm">
            {t('webviewNoticeTitle')}
          </p>
          <p className="text-nham-text-muted text-xs">
            {t('webviewNotice')}
            {!android && ` ${t('webviewNoticeIosHint')}`}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
            {android && (
              <button
                type="button"
                onClick={openInChrome}
                className="font-sans-display font-semibold text-nham-accent text-xs transition-colors hover:text-[#A88B63]"
              >
                {t('webviewOpenInChrome')}
              </button>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="font-sans-display font-semibold text-nham-accent text-xs transition-colors hover:text-[#A88B63]"
            >
              {t('webviewCopyLink')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
