'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { FormInput } from '@/components/auth/form-input';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Step two of password recovery. The recovery link routes through
 * /auth/callback, which exchanges the code for a (recovery) session and lands
 * the user here. With that session active, `updateUser` sets the new password.
 * If there's no session (link expired or opened directly), we say so plainly
 * and point back home to request a fresh link.
 */
export default function ResetPasswordPage() {
  const t = useTranslations('auth.reset');
  const locale = useLocale();
  const [status, setStatus] = useState<'checking' | 'ready' | 'expired'>(
    'checking'
  );
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      setStatus(error || !data.user ? 'expired' : 'ready');
    });
  }, []);

  const schema = z
    .object({
      password: z.string().min(6, t('passwordError')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      message: t('mismatch'),
      path: ['confirm'],
    });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Values) => {
    setLoading(true);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });
    if (error) {
      setFormError(t('error'));
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    // Land in the app with the new password active.
    window.location.assign(`/${locale}/logging`);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-nham-surface px-4 font-sans-display">
      <div className="w-full max-w-[400px] rounded-2xl border border-nham-border/40 bg-[#FFFCF8] p-8 shadow-[0_25px_60px_-12px_rgba(44,36,22,0.18)]">
        <h1 className="mb-1 text-center font-normal font-serif text-2xl text-nham-text">
          {t('title')}
        </h1>
        <p className="mb-6 text-center text-nham-text-muted text-sm">
          {status === 'expired' ? t('expiredSubtitle') : t('subtitle')}
        </p>

        {status === 'checking' && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-nham-accent" />
          </div>
        )}

        {status === 'expired' && (
          <Link
            href="/"
            className="block w-full rounded-xl bg-nham-ink px-4 py-3 text-center font-medium text-sm text-white transition-colors hover:bg-[#3D3425]"
          >
            {t('backHome')}
          </Link>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label={t('password')}
              type="password"
              placeholder={t('passwordPlaceholder')}
              error={errors.password?.message}
              {...register('password')}
            />
            <FormInput
              label={t('confirm')}
              type="password"
              placeholder={t('confirmPlaceholder')}
              error={errors.confirm?.message}
              {...register('confirm')}
            />
            {formError && (
              <p className="text-nham-danger text-sm">{formError}</p>
            )}
            <button
              type="submit"
              disabled={loading || done}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-nham-ink px-4 py-3 font-medium text-sm text-white transition-colors hover:bg-[#3D3425] disabled:opacity-60"
            >
              {(loading || done) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t('submit')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
