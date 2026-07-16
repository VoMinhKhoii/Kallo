'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { CheckEmailPanel } from '@/components/auth/check-email-panel';
import { KalloAppIcon } from '@/components/brand/kallo-app-icon';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AuthDialog() {
  const tDialog = useTranslations('auth.dialog');
  const tSignIn = useTranslations('auth.signIn');
  const tSignUp = useTranslations('auth.signUp');
  const tForgot = useTranslations('auth.forgot');
  const tCheck = useTranslations('auth.checkEmail');
  const { open, tab, panel, closeDialog, setTab } = useAuthDialog();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management: trap Tab inside the dialog, close on Escape, and
  // restore focus to the opener when the dialog unmounts.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, closeDialog]);

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
            className="fixed inset-0 z-100 bg-nham-ink/40 backdrop-blur-sm"
            onClick={closeDialog}
          />

          {/* Dialog */}
          <motion.div
            key="auth-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
            }}
            className="fixed top-1/2 left-1/2 z-101 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 focus:outline-none"
          >
            <div className="overflow-hidden rounded-2xl border border-nham-border/40 bg-[#FFFCF8] shadow-[0_25px_60px_-12px_rgba(44,36,22,0.25),0_0_0_1px_rgba(201,168,124,0.08)]">
              {/* Header */}
              <div className="px-8 pt-8 pb-2 text-center">
                <KalloAppIcon className="mx-auto mb-4 w-12 rounded-xl" />
                <h2
                  id="auth-dialog-title"
                  className="mb-1 font-normal font-serif text-2xl text-nham-text"
                >
                  {title}
                </h2>
                <p className="font-sans-display text-nham-text-muted text-sm">
                  {subtitle}
                </p>
              </div>

              {/* Credentials screen: Google first, then email form. The mode
                  (sign in vs create account) is carried by the title + the one
                  bottom toggle link — the redundant segmented tabs are gone. */}
              {panel === 'auth' && (
                <>
                  {/* Google leads — the fastest path */}
                  <div className="space-y-3 px-8 pt-4">
                    <GoogleSignInButton />
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-nham-border/60" />
                      <span className="font-sans-display text-nham-text-muted text-xs">
                        {tDialog('orContinueWithEmail')}
                      </span>
                      <div className="h-px flex-1 bg-nham-border/60" />
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
                    <p className="mt-5 text-center font-sans-display text-nham-text-muted text-sm">
                      {tab === 'sign-in'
                        ? tSignIn('noAccount')
                        : tSignUp('hasAccount')}
                      <button
                        type="button"
                        onClick={() =>
                          setTab(tab === 'sign-in' ? 'sign-up' : 'sign-in')
                        }
                        className="font-semibold text-nham-accent transition-colors hover:text-[#A88B63]"
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
