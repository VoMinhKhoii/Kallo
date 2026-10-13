'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';
import { useLeaveChatGroup } from '@/hooks/social/circle/use-chat-groups';
import { useRouter } from '@/i18n/navigation';

/** The quiet leave action at the bottom of the group-info panel; confirmation
 * stays explicit because leaving immediately revokes access. */
export function GroupLeaveButton({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.feed');
  const router = useRouter();
  const leave = useLeaveChatGroup();

  return (
    <ConfirmDialog
      trigger={
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[#6E6D66] transition-colors duration-200 hover:bg-kallo-hover hover:text-[#141413]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium font-sans-display text-[13px] tracking-tight">
            {t('leave')}
          </span>
        </button>
      }
      title={t('leaveTitle')}
      description={t('leaveDescription')}
      confirmLabel={t('leaveConfirm')}
      cancelLabel={t('cancel')}
      tone="destructive"
      pending={leave.isPending}
      onConfirm={(event) => {
        event.preventDefault();
        leave.mutate(groupId, {
          onSuccess: () => router.push('/circle'),
          onError: () => toast.error(t('leaveError')),
        });
      }}
    />
  );
}
