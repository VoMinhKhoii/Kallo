'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useWaitlistSignup } from '@/hooks/landing/use-waitlist-signup';
import type { WaitlistSignupInput } from '@/lib/api/contracts/waitlist';
import { ApiError } from '@/lib/errors';
import type { HeroTone } from './tone';

/**
 * The waitlist, wearing the meal-input pill.
 *
 * Same behaviour as the production `WaitlistForm` — same hook, same contract,
 * same double opt-in and the same copy — but shaped like the command bar the
 * lab used before it, because that shape is what makes the hero read as the
 * product rather than as a signup page. Kept here rather than restyling the
 * shipping component, which the real landing page still uses as-is.
 */
export function WaitlistPill({ tone }: { tone: HeroTone }) {
  const t = useTranslations('landing.hero.waitlist');
  const locale = useLocale();
  const signup = useWaitlistSignup();
  const dark = tone === 'espresso';

  const schema = z.object({ email: z.email(t('invalidEmail')) });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const muted = dark ? 'text-[#B8A88E]' : 'text-nham-text-muted';

  if (signup.isSuccess) {
    return (
      <output
        aria-live="polite"
        className={`mx-auto flex w-full max-w-2xl items-start gap-3 rounded-[1.75rem] border px-5 py-4 text-left ${
          dark
            ? 'border-white/12 bg-white/[0.06]'
            : 'border-nham-border bg-white'
        }`}
      >
        <MailCheck
          className={`mt-0.5 h-5 w-5 shrink-0 ${dark ? 'text-nham-surface' : 'text-nham-text'}`}
        />
        <div>
          <p
            className={`font-medium font-sans-display text-sm ${dark ? 'text-nham-surface' : 'text-nham-text'}`}
          >
            {t('success')}
          </p>
          <p className={`mt-1 font-sans-display text-sm ${muted}`}>
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
        className={`flex h-14 w-full items-center gap-3 rounded-full border py-2 pr-2 pl-5 transition-colors focus-within:border-nham-accent focus-within:ring-[3px] focus-within:ring-nham-accent/25 sm:h-16 sm:pl-6 ${
          dark
            ? 'border-white/12 bg-white/[0.06] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]'
            : 'border-nham-border bg-white shadow-[0_20px_50px_-20px_rgba(105,94,78,0.35)]'
        } ${errors.email ? 'border-nham-danger/60' : ''}`}
      >
        <Sparkles
          aria-hidden
          className={`h-[18px] w-[18px] shrink-0 ${dark ? 'text-nham-surface/70' : 'text-nham-stone'}`}
        />

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
          className={`min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#B0A695] disabled:cursor-default sm:text-lg ${
            dark ? 'text-nham-surface' : 'text-nham-text'
          }`}
          {...register('email')}
        />

        <button
          type="submit"
          disabled={signup.isPending}
          className={`group flex h-10 shrink-0 items-center gap-2 rounded-full px-4 font-medium font-sans-display text-sm transition-[transform,background-color] active:scale-[0.98] disabled:opacity-60 sm:h-11 sm:px-5 ${
            dark
              ? 'bg-nham-surface text-nham-text hover:bg-white'
              : 'bg-nham-ink text-nham-surface hover:bg-nham-ink-hover'
          }`}
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
      <p className={`mt-3 font-sans-display text-xs ${muted}`}>
        {t('privacy')}
      </p>
    </form>
  );
}
