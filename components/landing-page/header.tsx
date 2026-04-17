'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';

export function Header() {
  const t = useTranslations('landing');
  const { openDialog } = useAuthDialog();

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
            style={{ fontFamily: 'Lora, serif' }}
          >
            Nham
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('header.features')}
          </a>
          <a
            href="#how"
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('header.howItWorks')}
          </a>
          <a
            href="#pricing"
            className="text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('header.pricing')}
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          <Button
            variant="landing-ghost"
            className="hidden sm:block"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
            onClick={() => openDialog('sign-in')}
          >
            {t('header.signIn')}
          </Button>
          <Button
            variant="header-cta"
            size="header"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
            onClick={() => openDialog('sign-up')}
          >
            {t('header.getStarted')}
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
