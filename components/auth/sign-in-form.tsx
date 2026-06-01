'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { FormInput } from '@/components/auth/form-input';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignInForm() {
  const t = useTranslations('auth.signIn');
  const router = useRouter();
  const { closeDialog, next } = useAuthDialog();
  const [loading, setLoading] = useState(false);

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success(t('success'));
    closeDialog();
    if (next) {
      // `next` is a full locale-prefixed path (e.g. /en/invite/abc). A hard
      // navigation makes the server re-read the fresh session cookie so the
      // invite page resolves as signed-in.
      window.location.assign(next);
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
      <FormInput
        label={t('password')}
        type="password"
        placeholder={t('passwordPlaceholder')}
        error={errors.password?.message}
        {...register('password')}
      />
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C2416] px-4 py-3 font-medium text-sm text-white tracking-tight transition-all duration-200 hover:bg-[#3D3425] disabled:opacity-60"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('submit')}
      </button>
    </form>
  );
}
