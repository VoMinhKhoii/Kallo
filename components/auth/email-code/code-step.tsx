'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { TurnstileField } from '@/components/auth/email-code/turnstile-field';
import { useTurnstile } from '@/hooks/auth/use-turnstile';
import { useRouter } from '@/i18n/navigation';
import {
  EMAIL_CODE_MAX_LENGTH,
  EMAIL_CODE_MIN_LENGTH,
  emailCodeErrorKey,
  emailCodeRedirect,
  RESEND_COOLDOWN_SECONDS,
  sendEmailCode,
} from '@/lib/infra/auth/email-code';
import { safeNextPath } from '@/lib/infra/auth/safe-next';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * Step two of email sign-in: type the emailed code. A code that arrives whole
 * — pasted, or filled from the browser's one-time-code suggestion — submits by
 * itself; a typed one submits with Continue, because the length is the
 * project's setting (6–10), not something the field can count to. "Send a new
 * code" waits out Supabase's per-address cooldown and carries its own
 * Turnstile token.
 */
export function CodeStep() {
  const t = useTranslations('auth.emailCode');
  const locale = useLocale();
  const router = useRouter();
  const { codeEmail, next, closeDialog, showAuth, turnstileSiteKey } =
    useAuthDialog();
  const turnstile = useTurnstile(turnstileSiteKey, locale);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!codeEmail) return null;

  const verify = async (value: string) => {
    setVerifying(true);
    setError(null);
    setNotice(null);
    const { error: verifyError } = await createClient().auth.verifyOtp({
      email: codeEmail,
      token: value,
      type: 'email',
    });

    if (verifyError) {
      setError(t(`errors.${emailCodeErrorKey(verifyError)}`));
      setVerifying(false);
      return;
    }

    closeDialog();
    // `next` (an invite link) is re-validated so it can never become an open
    // redirect; a hard navigation makes the server re-read the new session.
    const safeNext = safeNextPath(next);
    if (safeNext) {
      window.location.assign(safeNext);
      return;
    }
    router.push('/logging');
    router.refresh();
  };

  const onCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, EMAIL_CODE_MAX_LENGTH);
    // More than one digit in a single change means the code arrived whole.
    const arrivedWhole = digits.length - code.length > 1;
    setCode(digits);
    setError(null);
    if (arrivedWhole && digits.length >= EMAIL_CODE_MIN_LENGTH && !verifying) {
      void verify(digits);
    }
  };

  const complete = code.length >= EMAIL_CODE_MIN_LENGTH;

  const resend = async () => {
    // A Turnstile token is single-use: a second click while the first send is
    // in flight would spend it twice.
    setResending(true);
    setError(null);
    setNotice(null);
    const sendError = await sendEmailCode(createClient(), {
      email: codeEmail,
      emailRedirectTo: emailCodeRedirect(window.location.origin, next, locale),
      captchaToken: turnstile.token,
    });
    turnstile.reset();
    setResending(false);
    if (sendError) {
      setError(t(`errors.${emailCodeErrorKey(sendError)}`));
      return;
    }
    setCode('');
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice(t('resent'));
  };

  // As on the email step, a check that could not run leaves it to the server.
  const canResend =
    cooldown === 0 &&
    !verifying &&
    !resending &&
    (!turnstile.required || !!turnstile.token || turnstile.failed);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete && !verifying) void verify(code);
      }}
    >
      <div className="space-y-1 text-center">
        <p className="font-sans-display text-kallo-text-muted text-sm">
          {t('sentTo')}
        </p>
        <p className="font-serif text-base text-kallo-text">{codeEmail}</p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="email-code"
          className="block font-medium font-sans-display text-kallo-text text-xs tracking-wide"
        >
          {t('codeLabel')}
        </label>
        <input
          id="email-code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_MAX_LENGTH}
          // biome-ignore lint/a11y/noAutofocus: the code field is this step's only task, reached by the user's own "Send code".
          autoFocus
          aria-invalid={error ? true : undefined}
          className="w-full rounded-xl border border-kallo-border/60 bg-card px-4 py-3 text-center font-sans-display text-kallo-text text-xl tracking-[0.4em] outline-none transition-all duration-200 focus:border-kallo-accent focus:ring-2 focus:ring-kallo-accent/10"
        />
        {error && (
          <p
            role="alert"
            className="font-sans-display text-kallo-danger text-sm"
          >
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="font-sans-display text-kallo-text-muted text-sm">
            {notice}
          </p>
        )}
      </div>

      <div>
        <TurnstileField turnstile={turnstile} />
        <button
          type="submit"
          disabled={verifying || !complete}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-kallo-ink px-4 py-3 font-medium font-sans-display text-kallo-surface text-sm tracking-tight transition-all duration-200 hover:bg-kallo-ink-hover disabled:opacity-60"
        >
          {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('verify')}
        </button>
      </div>

      <div className="space-y-3 text-center">
        <button
          type="button"
          onClick={resend}
          disabled={!canResend}
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
    </form>
  );
}
