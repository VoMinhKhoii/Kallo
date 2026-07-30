'use client';

import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { Button } from '@/components/ui/button';

/**
 * Left column of the hero: the promise, then the ask.
 *
 * The primary ask is the waitlist form passed in as `children` — while Kallo is
 * in beta, an email address is a far lower bar than an account. Creating an
 * account outright stays available directly underneath, demoted rather than
 * removed, so a visitor who is already sold doesn't have to hunt for it.
 */
export function HeroIntro({ children }: { children: React.ReactNode }) {
  const t = useTranslations('landing.hero');
  const { openDialog } = useAuthDialog();

  return (
    <div className="relative z-20 text-left lg:col-span-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-8 inline-flex items-center gap-2 rounded-full border border-nham-border bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm"
      >
        <Sparkles className="h-3.5 w-3.5 text-nham-accent" />
        <span className="font-semibold text-nham-text-muted text-xs uppercase tracking-widest">
          {t('badge')}
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="mb-8 font-normal font-serif text-5xl text-nham-text leading-[1.1] lg:text-7xl"
      >
        {t('title')} <br />
        <span className="font-light text-nham-accent italic">
          {t('titleHighlight')}
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-8 max-w-md font-light font-sans-display text-lg text-nham-text-soft leading-relaxed"
      >
        {t('subtitle')}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="max-w-md"
      >
        {children}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="hero-outline"
            size="hero"
            onClick={() => openDialog('sign-up')}
          >
            {t('cta')}
          </Button>
          <Button
            variant="landing-ghost"
            size="hero"
            onClick={() => scrollToAnchorId('how')}
          >
            {t('ctaSecondary')}
          </Button>
        </div>
      </motion.div>

      {/* Honest beta note — no fabricated avatars or "loved by N users"
          claims for a product that is just launching. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 1 }}
        className="mt-12 text-nham-text-muted text-sm"
      >
        <p className="font-medium">{t('beta')}</p>
      </motion.div>
    </div>
  );
}
