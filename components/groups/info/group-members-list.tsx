'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
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
import { useRemoveGroupMember } from '@/hooks/social/use-chat-groups';
import type { ChatGroupDetail } from '@/lib/chat-groups/client';

/** Member rows with avatars; the owner additionally gets a confirm-gated
 * remove action on every row but their own (self-removal is "Leave group"). */
export function GroupMembersList({ group }: { group: ChatGroupDetail }) {
  const t = useTranslations('groups.info');
  const tFeed = useTranslations('groups.feed');
  const removeMember = useRemoveGroupMember(group.id);
  const isOwner = group.myRole === 'owner';

  return (
    <ul className="space-y-1">
      {group.members.map((member) => {
        const name = labelFor(member);
        return (
          <li
            key={member.userId}
            className="group/member flex items-center gap-2.5 rounded-xl px-1.5 py-1.5"
          >
            <ProfileAvatar avatarUrl={member.avatarUrl} label={name} />
            <span className="min-w-0 flex-1 truncate font-sans-display text-[#141413] text-[13.5px]">
              {name}
            </span>
            {member.role === 'owner' ? (
              <span className="shrink-0 font-sans-display text-[#6E6D66] text-[11px]">
                {t('owner')}
              </span>
            ) : (
              isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={t('removeLabel', { name })}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#6E6D66] opacity-0 transition-all hover:bg-kallo-danger/10 hover:text-kallo-danger focus-visible:opacity-100 group-hover/member:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-normal font-serif text-[18px]">
                        {t('removeTitle', { name })}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
                        {t('removeDescription')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tFeed('cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        variant="ghost"
                        disabled={removeMember.isPending}
                        className="text-kallo-danger hover:bg-transparent hover:text-kallo-danger"
                        onClick={(event) => {
                          event.preventDefault();
                          removeMember.mutate(member.userId, {
                            onError: () => toast.error(t('removeError')),
                          });
                        }}
                      >
                        {t('removeConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
