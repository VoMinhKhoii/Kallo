'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLeaveChatGroup } from '@/hooks/social/use-chat-groups';
import { useRouter } from '@/i18n/navigation';
import type { ChatGroupDetail } from '@/lib/chat-groups/client';

/** Compact group membership summary with a deliberately quiet leave action;
 * confirmation remains explicit because leaving immediately revokes access. */
export function GroupMembersRow({
  group,
}: {
  group: ChatGroupDetail | undefined;
}) {
  const t = useTranslations('groups.feed');
  const router = useRouter();
  const leave = useLeaveChatGroup();
  if (!group) return null;

  const names = group.members
    .map((member) => member.displayName?.trim() || member.handle)
    .join(' · ');

  return (
    <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3 px-1 font-sans-display text-[11.5px] text-nham-text-muted">
      <p className="min-w-0 truncate">{t('members', { names })}</p>
      {group.kind === 'group' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="shrink-0 transition-colors hover:text-nham-danger"
            >
              {t('leave')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-nham-border/60 bg-white text-nham-text">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-normal font-serif text-[18px]">
                {t('leaveTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription className="font-sans-display text-[13px] text-nham-text-muted">
                {t('leaveDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="ghost"
                disabled={leave.isPending}
                className="text-nham-danger hover:bg-transparent hover:text-nham-danger"
                onClick={(event) => {
                  event.preventDefault();
                  leave.mutate(group.id, {
                    onSuccess: () => router.push('/groups'),
                    onError: () => toast.error(t('leaveError')),
                  });
                }}
              >
                {t('leaveConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
