'use client';

import { useTranslations } from 'next-intl';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider, useAuthDialog } from '@/components/auth/auth-provider';

/**
 * Signed-out invite CTA that keeps auth ON the invite page. Instead of
 * teleporting to the marketing page (which erased the inviter at the moment of
 * commitment), the auth dialog opens here over the inviter's card, and `next`
 * round-trips the user straight back to this invite link — now signed in, so
 * the page resolves to Connect.
 */
function InviteAuthButton() {
  const t = useTranslations('groups.connect');
  const { openDialog } = useAuthDialog();

  return (
    <button
      type="button"
      onClick={() => openDialog('sign-up')}
      className="inline-flex items-center justify-center rounded-xl bg-nham-btn px-6 py-3 font-medium font-sans-display text-[15px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90"
    >
      {t('signIn')}
    </button>
  );
}

export function InviteAuthCta({ next }: { next: string }) {
  return (
    <AuthProvider next={next} initialTab="sign-up">
      <InviteAuthButton />
      <AuthDialog />
    </AuthProvider>
  );
}
