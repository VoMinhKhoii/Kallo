'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { FormInput } from '@/components/auth/form-input';
import { createClient } from '@/lib/supabase/client';

/**
 * Step one of password recovery: request a reset link. The email lands the
 * user on /auth/callback (which exchanges the recovery code for a session) and
 * then /reset-password, where they set a new password.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot');
  const locale = useLocale();
  const { showAuth, showCheckEmail } = useAuthDialog();
  const [loading, setLoading] = useState(false);

  const schema = z.object({ email: z.email(t('emailError')) });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Values) => {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      `/${locale}/reset-password`
    )}`;
    // Supabase returns success regardless of whether the address exists
    // (anti-enumeration). We mirror that: always advance to "check your email".
    await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });
    setLoading(false);
    showCheckEmail(data.email, 'reset');
  };

  return (
    <div className="space-y-4">
      <p className="font-sans-display text-nham-text-muted text-sm leading-relaxed">
        {t('description')}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          label={t('email')}
          type="email"
          placeholder={t('emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-nham-ink px-4 py-3 font-medium font-sans-display text-sm text-white tracking-tight transition-all duration-200 hover:bg-nham-ink-hover disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('submit')}
        </button>
      </form>
      <button
        type="button"
        onClick={showAuth}
        className="mx-auto flex items-center gap-1.5 font-sans-display text-nham-text-muted text-sm transition-colors hover:text-nham-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('back')}
      </button>
    </div>
  );
}
