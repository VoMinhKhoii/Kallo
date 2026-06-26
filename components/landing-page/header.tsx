'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';

export function Header() {
  const t = useTranslations('landing.header');
  const { openDialog } = useAuthDialog();

  // Smooth-scroll the in-page anchors, honoring reduced-motion (instant jump
  // for users who opt out). Offsets for the fixed header via scroll-margin.
  const scrollToAnchor =
    (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      const target = document.getElementById(id);
      if (!target) return;
      const prefersReduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      target.scrollIntoView({
        behavior: prefersReduced ? 'auto' : 'smooth',
        block: 'start',
      });
    };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 right-0 left-0 z-50 border-[#E8D5B5]/30 border-b bg-[#FEFBF6]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="font-medium text-2xl text-[#2C2416]"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            Nhẩm
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            onClick={scrollToAnchor('features')}
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('features')}
          </a>
          <a
            href="#how"
            onClick={scrollToAnchor('how')}
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('howItWorks')}
          </a>
          <a
            href="#pricing"
            onClick={scrollToAnchor('pricing')}
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('pricing')}
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Button
            variant="landing-ghost"
            className="hidden sm:block"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
            onClick={() => openDialog('sign-in')}
          >
            {t('signIn')}
          </Button>
          <Button
            variant="header-cta"
            size="header"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
            onClick={() => openDialog('sign-up')}
          >
            {t('getStarted')}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
