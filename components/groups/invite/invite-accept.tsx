'use client';

import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAcceptInvite } from '@/hooks/use-invite';
import { useRouter } from '@/i18n/navigation';

/**
 * The recipient's Connect button on a link invite. Their tap accepts and
 * connects them to the inviter, then routes into their circle.
 */
export function InviteAccept({ slug }: { slug: string }) {
  const t = useTranslations('groups.connect');
  const router = useRouter();
  const accept = useAcceptInvite();

  const onAccept = () => {
    accept.mutate(slug, {
      onSuccess: () => router.push('/groups'),
      onError: () => toast.error(t('error')),
    });
  };

  return (
    <button
      type="button"
      onClick={onAccept}
      disabled={accept.isPending}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-nham-btn px-6 py-3 font-medium text-[15px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {accept.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      {t('accept')}
    </button>
  );
}
