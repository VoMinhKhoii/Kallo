'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { HeroIntro } from '@/components/landing-page/hero/hero-intro';
import { HeroPhone } from '@/components/landing-page/hero/hero-phone';
import { WaitlistForm } from '@/components/landing-page/waitlist/waitlist-form';
import { useHeroDemo } from '@/hooks/landing/use-hero-demo';

/**
 * Landing hero: the pitch and the waitlist form on the left, a playable demo of
 * the product on the right. Composition only — the demo's state machine lives
 * in `useHeroDemo` and each column owns its own markup.
 */
export function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, 30]);
  const { openDialog } = useAuthDialog();
  const demo = useHeroDemo();

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-nham-surface pt-24 pb-12 lg:pt-32 lg:pb-20">
      {/* Refined Background Decor */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-nham-border/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-nham-accent/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-12 px-6 lg:grid-cols-5 lg:gap-20">
        <HeroIntro>
          <WaitlistForm source="hero" />
        </HeroIntro>

        <motion.div
          style={{ y }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative flex items-center justify-center lg:col-span-3"
        >
          <HeroPhone demo={demo} onSave={() => openDialog('sign-up')} />
        </motion.div>
      </div>
    </section>
  );
}
