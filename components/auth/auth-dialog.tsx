'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { TabButton } from '@/components/auth/tab-button';

export function AuthDialog() {
  const t = useTranslations('auth');
  const { open, tab, closeDialog, setTab } = useAuthDialog();

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="auth-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 bg-[#2C2416]/40 backdrop-blur-sm"
            onClick={closeDialog}
          />

          {/* Dialog */}
          <motion.div
            key="auth-dialog"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            className="fixed top-1/2 left-1/2 z-101 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-[#E8D5B5]/40 bg-[#FFFCF8] shadow-[0_25px_60px_-12px_rgba(44,36,22,0.25),0_0_0_1px_rgba(201,168,124,0.08)]">
              {/* Header */}
              <div className="px-8 pt-8 pb-2 text-center">
                <h2
                  className="mb-1 font-normal text-2xl text-[#2C2416]"
                  style={{ fontFamily: 'Lora, serif' }}
                >
                  {tab === 'sign-in'
                    ? t('dialog.signInTitle')
                    : t('dialog.signUpTitle')}
                </h2>
                <p
                  className="text-[#8B7355] text-sm"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {tab === 'sign-in'
                    ? t('dialog.signInSubtitle')
                    : t('dialog.signUpSubtitle')}
                </p>
              </div>

              {/* Tab Toggle */}
              <div className="px-8 pt-4 pb-2">
                <div className="flex rounded-xl bg-[#F0EAE0]/60 p-1">
                  <TabButton
                    active={tab === 'sign-in'}
                    onClick={() => setTab('sign-in')}
                  >
                    {t('dialog.signInTab')}
                  </TabButton>
                  <TabButton
                    active={tab === 'sign-up'}
                    onClick={() => setTab('sign-up')}
                  >
                    {t('dialog.signUpTab')}
                  </TabButton>
                </div>
              </div>

              {/* Form */}
              <div className="px-8 pt-4 pb-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, x: tab === 'sign-in' ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: tab === 'sign-in' ? 10 : -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {tab === 'sign-in' ? <SignInForm /> : <SignUpForm />}
                  </motion.div>
                </AnimatePresence>

                {/* Toggle Link */}
                <p
                  className="mt-5 text-center text-[#8B7355] text-sm"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {tab === 'sign-in'
                    ? t('signIn.noAccount')
                    : t('signUp.hasAccount')}
                  <button
                    type="button"
                    onClick={() =>
                      setTab(tab === 'sign-in' ? 'sign-up' : 'sign-in')
                    }
                    className="font-semibold text-[#C9A87C] transition-colors hover:text-[#A88B63]"
                  >
                    {tab === 'sign-in'
                      ? t('signIn.signUpLink')
                      : t('signUp.signInLink')}
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
