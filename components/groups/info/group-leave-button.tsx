'use client';

import { LogOut } from 'lucide-react';
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

/** The quiet leave action at the bottom of the group-info panel; confirmation
 * stays explicit because leaving immediately revokes access. */
export function GroupLeaveButton({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.feed');
  const router = useRouter();
  const leave = useLeaveChatGroup();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[#6E6D66] transition-colors duration-200 hover:bg-kallo-hover hover:text-[#141413]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium font-sans-display text-[13px] tracking-tight">
            {t('leave')}
          </span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-serif text-[18px]">
            {t('leaveTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
            {t('leaveDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="ghost"
            disabled={leave.isPending}
            className="text-kallo-danger hover:bg-transparent hover:text-kallo-danger"
            onClick={(event) => {
              event.preventDefault();
              leave.mutate(groupId, {
                onSuccess: () => router.push('/circle'),
                onError: () => toast.error(t('leaveError')),
              });
            }}
          >
            {t('leaveConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
