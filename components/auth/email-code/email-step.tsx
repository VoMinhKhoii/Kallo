'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { TurnstileField } from '@/components/auth/email-code/turnstile-field';
import { FormInput } from '@/components/auth/form-input';
import { useTurnstile } from '@/hooks/auth/use-turnstile';
import {
  emailCodeErrorKey,
  emailCodeRedirect,
  sendEmailCode,
} from '@/lib/infra/auth/email-code';
import { createClient } from '@/lib/infra/supabase/client';

/**
 * Step one of email sign-in: the address, then "Send code". The same form
 * signs in an existing account and creates a new one — the code decides
 * nothing about which, so there is no sign-up form to choose.
 */
export function EmailStep() {
  const t = useTranslations('auth.emailCode');
  const locale = useLocale();
  const { next, showCode, turnstileSiteKey } = useAuthDialog();
  const turnstile = useTurnstile(turnstileSiteKey, locale);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({ email: z.email(t('emailError')) });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async ({ email }: Values) => {
    setLoading(true);
    setFormError(null);
    const error = await sendEmailCode(createClient(), {
      email,
      emailRedirectTo: emailCodeRedirect(window.location.origin, next, locale),
      captchaToken: turnstile.token,
    });
    // Spent either way: Turnstile tokens are single-use.
    turnstile.reset();
    setLoading(false);

    if (error) {
      setFormError(t(`errors.${emailCodeErrorKey(error)}`));
      return;
    }
    showCode(email);
  };

  // Until the check hands over a token there is nothing the send could carry.
  // A check that could not run at all (script blocked) does not hold the form:
  // the server decides, and while it only monitors it accepts the request.
  const waitingForCheck =
    turnstile.required && !turnstile.token && !turnstile.failed;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormInput
        label={t('email')}
        type="email"
        autoComplete="email"
        placeholder={t('emailPlaceholder')}
        error={errors.email?.message}
        {...register('email')}
      />

      <div>
        <TurnstileField turnstile={turnstile} />
        {formError && (
          <p className="mb-4 font-sans-display text-kallo-danger text-sm">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || waitingForCheck}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-kallo-ink px-4 py-3 font-medium font-sans-display text-kallo-surface text-sm tracking-tight transition-all duration-200 hover:bg-kallo-ink-hover disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('sendCode')}
        </button>
      </div>
    </form>
  );
}
