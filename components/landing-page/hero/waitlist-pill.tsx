'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useWaitlistSignup } from '@/hooks/landing/use-waitlist-signup';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { ApiError } from '@/lib/errors/client';
import { cn } from '@/lib/ui/cn';

/**
 * The waitlist, wearing the meal-input pill.
 *
 * Same hook, same contract, same double opt-in and the same copy as the
 * shipping `WaitlistForm` in `../waitlist/` — but shaped like the app's
 * composer, because that shape is what makes the hero read as the product
 * rather than as a signup page. The plain form stays for any surface that
 * wants a form rather than a hero.
 */
export function WaitlistPill() {
  const t = useTranslations('landing.hero.waitlist');
  const locale = useLocale();
  const signup = useWaitlistSignup();

  const schema = z.object({ email: z.email(t('invalidEmail')) });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  if (signup.isSuccess) {
    return (
      <output
        aria-live="polite"
        className="mx-auto flex w-full max-w-2xl items-start gap-3 rounded-[1.75rem] border border-kallo-border bg-white px-5 py-4 text-left"
      >
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-kallo-text" />
        <div>
          <p className="font-medium font-sans-display text-kallo-text text-sm">
            {t('success')}
          </p>
          <p className="mt-1 font-sans-display text-kallo-text-soft text-sm">
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
    <form
      onSubmit={handleSubmit((values) =>
        signup.mutate({
          email: values.email,
          locale: locale === 'vi' ? 'vi' : 'en',
          source: 'hero',
        } satisfies WaitlistSignupInput)
      )}
      noValidate
      className="mx-auto w-full max-w-2xl"
    >
      <div
        // `cn()`, not a template string: the base sets `border-kallo-border`
        // and the error state adds `border-kallo-danger/60`. Both write
        // border-color at equal specificity, so which one wins comes down to
        // the order they happen to sit in the generated stylesheet rather than
        // the order they are written here — the error border was a coin toss.
        // tailwind-merge drops the loser instead.
        className={cn(
          'flex w-full flex-col gap-3 rounded-[1.75rem] border border-kallo-border bg-white p-3 shadow-[0_20px_50px_-20px_rgba(105,94,78,0.35)] transition-colors focus-within:border-kallo-accent focus-within:ring-[3px] focus-within:ring-kallo-accent/25 sm:h-16 sm:flex-row sm:items-center sm:gap-3 sm:rounded-full sm:py-2 sm:pr-2 sm:pl-6',
          errors.email && 'border-kallo-danger/60'
        )}
      >
        <label htmlFor="hero-waitlist-email" className="sr-only">
          {t('label')}
        </label>
        <input
          id="hero-waitlist-email"
          type="email"
          autoComplete="email"
          placeholder={t('placeholder')}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'hero-waitlist-error' : undefined}
          disabled={signup.isPending}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-kallo-text outline-none placeholder:text-[#B0A695] disabled:cursor-default sm:px-0 sm:py-0 sm:text-lg"
          {...register('email')}
        />

        <button
          type="submit"
          disabled={signup.isPending}
          className="group flex h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-kallo-ink px-5 font-medium font-sans-display text-kallo-surface text-sm transition-[transform,background-color] hover:bg-kallo-ink-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <span className="whitespace-nowrap">
            {signup.isPending ? t('submitting') : t('submit')}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5" />
        </button>
      </div>

      {errors.email && (
        <p
          id="hero-waitlist-error"
          className="mt-2 font-sans-display text-kallo-danger text-xs"
        >
          {errors.email.message}
        </p>
      )}
      {signup.isError && (
        <p
          aria-live="polite"
          className="mt-2 font-sans-display text-kallo-danger text-xs"
        >
          {failureMessage}
        </p>
      )}
      <p className="mt-3 font-sans-display text-kallo-text-soft text-xs">
        {t('privacy')}
      </p>
    </form>
  );
}
