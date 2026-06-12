'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { FormInput } from '@/components/auth/form-input';
import { useRouter } from '@/i18n/navigation';
import { safeNextPath } from '@/lib/auth/safe-next';
import { createClient } from '@/lib/supabase/client';

export function SignUpForm() {
  const t = useTranslations('auth.signUp');
  const locale = useLocale();
  const router = useRouter();
  const { closeDialog, next, showCheckEmail } = useAuthDialog();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const signUpSchema = z.object({
    email: z.email(t('emailError')),
    password: z.string().min(6, t('passwordError')),
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
    setFormError(null);
    const supabase = createClient();
    // Return the recipient to their invite link after they confirm their email
    // (or immediately, if email confirmation is disabled). `next` is already a
    // full locale-prefixed path; the callback route re-validates it.
    const target = next ?? `/${locale}/logging`;
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo },
    });

    if (error) {
      setFormError(t('error'));
      setLoading(false);
      return;
    }

    setLoading(false);

    // Confirmation disabled → a session exists now, so resurface the invite
    // directly instead of telling them to check an email that won't arrive.
    if (result?.session) {
      closeDialog();
      toast.success(t('successSignedIn'));
      // Re-validate `next` before navigating so it can never become an open
      // redirect (when valid it is a full locale-prefixed in-app path).
      const safeNext = safeNextPath(next);
      if (safeNext) {
        window.location.assign(safeNext);
        return;
      }
      router.push('/logging');
      router.refresh();
      return;
    }

    // Confirmation enabled → no session yet; hold on a persistent "check your
    // email" panel (the link carries `next`) instead of a vanishing toast.
    showCheckEmail(data.email, 'confirm');
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

      {formError && (
        <p
          className="text-nham-danger text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {formError}
        </p>
      )}

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
