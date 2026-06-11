'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { CheckEmailPanel } from '@/components/auth/check-email-panel';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { TabButton } from '@/components/auth/tab-button';

export function AuthDialog() {
  const tDialog = useTranslations('auth.dialog');
  const tSignIn = useTranslations('auth.signIn');
  const tSignUp = useTranslations('auth.signUp');
  const tForgot = useTranslations('auth.forgot');
  const tCheck = useTranslations('auth.checkEmail');
  const { open, tab, panel, closeDialog, setTab } = useAuthDialog();

  if (!open) return null;

  const title =
    panel === 'forgot'
      ? tForgot('title')
      : panel === 'check-email'
        ? tCheck('title')
        : tab === 'sign-in'
          ? tDialog('signInTitle')
          : tDialog('signUpTitle');

  const subtitle =
    panel === 'forgot'
      ? tForgot('subtitle')
      : panel === 'check-email'
        ? tCheck('subtitle')
        : tab === 'sign-in'
          ? tDialog('signInSubtitle')
          : tDialog('signUpSubtitle');

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
                  {title}
                </h2>
                <p
                  className="text-[#8B7355] text-sm"
                  style={{ fontFamily: 'DM Sans, sans-serif' }}
                >
                  {subtitle}
                </p>
              </div>

              {/* Credentials screen: tabs + Google + email form */}
              {panel === 'auth' && (
                <>
                  {/* Tab Toggle */}
                  <div className="px-8 pt-4 pb-2">
                    <div className="flex rounded-xl bg-[#F0EAE0]/60 p-1">
                      <TabButton
                        active={tab === 'sign-in'}
                        onClick={() => setTab('sign-in')}
                      >
                        {tDialog('signInTab')}
                      </TabButton>
                      <TabButton
                        active={tab === 'sign-up'}
                        onClick={() => setTab('sign-up')}
                      >
                        {tDialog('signUpTab')}
                      </TabButton>
                    </div>
                  </div>

                  {/* Google + divider — same for both tabs */}
                  <div className="space-y-3 px-8 pt-4">
                    <GoogleSignInButton />
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#E8D5B5]/60" />
                      <span
                        className="text-[#8B7355] text-xs"
                        style={{ fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {tDialog('orContinueWithEmail')}
                      </span>
                      <div className="h-px flex-1 bg-[#E8D5B5]/60" />
                    </div>
                  </div>

                  {/* Form */}
                  <div className="px-8 pt-4 pb-6">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tab}
                        initial={{
                          opacity: 0,
                          x: tab === 'sign-in' ? -10 : 10,
                        }}
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
                        ? tSignIn('noAccount')
                        : tSignUp('hasAccount')}
                      <button
                        type="button"
                        onClick={() =>
                          setTab(tab === 'sign-in' ? 'sign-up' : 'sign-in')
                        }
                        className="font-semibold text-[#C9A87C] transition-colors hover:text-[#A88B63]"
                      >
                        {tab === 'sign-in'
                          ? tSignIn('signUpLink')
                          : tSignUp('signInLink')}
                      </button>
                    </p>
                  </div>
                </>
              )}

              {/* Recovery screens */}
              {panel !== 'auth' && (
                <div className="px-8 pt-4 pb-7">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={panel}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {panel === 'forgot' ? (
                        <ForgotPasswordForm />
                      ) : (
                        <CheckEmailPanel />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
