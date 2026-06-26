'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { FormInput } from '@/components/auth/form-input';
import { useRouter } from '@/i18n/navigation';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/client';

export function SignInForm() {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const { closeDialog, next, showForgot } = useAuthDialog();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const signInSchema = z.object({
    email: z.email(t('emailError')),
    password: z.string().min(6, t('passwordError')),
  });

  type SignInValues = z.infer<typeof signInSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInValues) => {
    setLoading(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      // Supabase returns the same error for a wrong password and a nonexistent
      // account (anti-enumeration), so the copy stays neutral and renders
      // inline — never a raw API string in a toast.
      setFormError(
        error.message === 'Email not confirmed'
          ? t('errorUnconfirmed')
          : t('error')
      );
      setLoading(false);
      return;
    }

    closeDialog();
    // `next` is a full locale-prefixed path (e.g. /en/invite/abc), re-validated
    // here so it can never become an open redirect. A hard navigation makes the
    // server re-read the fresh session cookie so the invite page resolves as
    // signed-in.
    const safeNext = safeNextPath(next);
    if (safeNext) {
      window.location.assign(safeNext);
      return;
    }
    router.push('/logging');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormInput
        label={t('email')}
        type="email"
        placeholder={t('emailPlaceholder')}
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="space-y-1.5">
        <FormInput
          label={t('password')}
          type="password"
          placeholder={t('passwordPlaceholder')}
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={showForgot}
            className="font-sans-display text-[#8B7355] text-xs transition-colors hover:text-[#2C2416]"
          >
            {t('forgotPassword')}
          </button>
        </div>
      </div>

      {formError && (
        <p className="font-sans-display text-nham-danger text-sm">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C2416] px-4 py-3 font-medium font-sans-display text-sm text-white tracking-tight transition-all duration-200 hover:bg-[#3D3425] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('submit')}
      </button>
    </form>
  );
}
