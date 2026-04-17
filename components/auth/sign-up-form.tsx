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

export function SignUpForm() {
  const t = useTranslations('auth');
  const { closeDialog } = useAuthDialog();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const signUpSchema = z.object({
    email: z.email(t('signUp.emailError')),
    password: z.string().min(6, t('signUp.passwordError')),
  });

  type SignUpValues = z.infer<typeof signUpSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpValues) => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    closeDialog();
    router.push('/logging');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormInput
        label={t('signUp.email')}
        type="email"
        placeholder={t('signUp.emailPlaceholder')}
        error={errors.email?.message}
        {...register('email')}
      />
      <FormInput
        label={t('signUp.password')}
        type="password"
        placeholder={t('signUp.passwordPlaceholder')}
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
        {t('signUp.submit')}
      </button>
    </form>
  );
}
