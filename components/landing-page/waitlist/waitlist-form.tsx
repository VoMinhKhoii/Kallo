'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { useWaitlistSignup } from '@/hooks/landing/use-waitlist-signup';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { ApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';

/**
 * Landing-page waitlist capture — the hero's primary call to action.
 *
 * Double opt-in, so success here means "check your inbox", never "you're on the
 * list". The success state replaces the form inline rather than firing a toast:
 * the next step is in another app, and a message that vanishes in four seconds
 * is the wrong place to say so.
 */
export function WaitlistForm({ source = 'hero' }: { source?: 'hero' | 'cta' }) {
  const t = useTranslations('landing.hero.waitlist');
  const locale = useLocale();
  const signup = useWaitlistSignup();

  const schema = z.object({ email: z.email(t('invalidEmail')) });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = ({ email }: { email: string }) => {
    signup.mutate({
      email,
      locale: locale === 'vi' ? 'vi' : 'en',
      source,
    } satisfies WaitlistSignupInput);
  };

  if (signup.isSuccess) {
    return (
      <output
        aria-live="polite"
        className="flex items-start gap-3 rounded-xl border border-nham-border bg-white/70 px-4 py-4"
      >
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-nham-accent" />
        <div>
          <p className="font-medium font-sans-display text-nham-text text-sm">
            {t('success')}
          </p>
          <p className="mt-1 font-sans-display text-nham-text-muted text-sm">
            {t('successBody')}
          </p>
        </div>
      </output>
    );
  }

  const failureMessage =
    signup.error instanceof ApiError && signup.error.code === 'RATE_LIMITED'
      ? t('rateLimited')
      : t('error');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="waitlist-email" className="sr-only">
            {t('label')}
          </label>
          <input
            id="waitlist-email"
            type="email"
            autoComplete="email"
            placeholder={t('placeholder')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'waitlist-email-error' : undefined}
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-4 font-sans-display text-base text-nham-text outline-none transition-all duration-200 placeholder:text-nham-text-muted/70',
              errors.email
                ? 'border-nham-danger/50 focus:border-nham-danger focus:ring-2 focus:ring-nham-danger/10'
                : 'border-nham-border/60 focus:border-nham-accent focus:ring-2 focus:ring-nham-accent/10'
            )}
            {...register('email')}
          />
        </div>
        <Button
          type="submit"
          variant="hero-dark"
          size="hero"
          className="group shrink-0"
          disabled={signup.isPending}
        >
          {signup.isPending ? t('submitting') : t('submit')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {errors.email && (
        <p
          id="waitlist-email-error"
          className="mt-2 font-sans-display text-nham-danger text-xs"
        >
          {errors.email.message}
        </p>
      )}
      {signup.isError && (
        <p
          aria-live="polite"
          className="mt-2 font-sans-display text-nham-danger text-xs"
        >
          {failureMessage}
        </p>
      )}
      <p className="mt-3 font-sans-display text-nham-text-muted text-xs">
        {t('privacy')}
      </p>
    </form>
  );
}
