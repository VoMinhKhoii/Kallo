'use client';

import { ArrowLeft, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { createClient } from '@/lib/supabase/client';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Persistent "we sent you a link" state. Reached after sign-up (confirmation
 * enabled) or after requesting a password reset. Offers a cooldown-gated resend
 * and a way back to the credentials screen, instead of the old vanishing toast.
 */
export function CheckEmailPanel() {
  const t = useTranslations('auth.checkEmail');
  const locale = useLocale();
  const { checkEmail, showAuth, next } = useAuthDialog();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!checkEmail) return null;
  const { email, mode } = checkEmail;

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const supabase = createClient();
    if (mode === 'reset') {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        `/${locale}/reset-password`
      )}`;
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    } else {
      const target = next ?? `/${locale}/logging`;
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        target
      )}`;
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });
    }
  };

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-kallo-hover">
        <MailCheck className="h-5 w-5 text-kallo-text-muted" />
      </div>
      <div className="space-y-2">
        <p className="font-sans-display text-kallo-text-muted text-sm leading-relaxed">
          {mode === 'reset' ? t('descriptionReset') : t('descriptionConfirm')}
        </p>
        <p className="font-serif text-base text-kallo-text">{email}</p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="font-sans-display text-kallo-text-muted text-sm transition-colors hover:text-kallo-text disabled:text-kallo-text-muted/60 disabled:hover:text-kallo-text-muted/60"
        >
          {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resend')}
        </button>

        <button
          type="button"
          onClick={showAuth}
          className="mx-auto flex items-center gap-1.5 font-sans-display text-kallo-text-muted text-sm transition-colors hover:text-kallo-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </button>
      </div>
    </div>
  );
}
