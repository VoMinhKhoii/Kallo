'use client';

import { ChevronDown, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { GroupAddPeople } from '@/components/groups/info/group-add-people';
import { GroupLeaveButton } from '@/components/groups/info/group-leave-button';
import { GroupMembersList } from '@/components/groups/info/group-members-list';
import { useRenameGroup } from '@/hooks/social/use-chat-groups';
import type { ChatGroupDetail } from '@/lib/chat-groups/client';
import { cn } from '@/lib/utils';

/** Messenger-style collapsible section: bold heading row with a chevron that
 * flips as it opens. Sections default open — the chevron is for tidying up. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-[#141413]/[0.03]"
      >
        <span className="font-sans-display font-semibold text-[#141413] text-[13px]">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'size-4 text-[#6E6D66] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && <div className="pt-1 pb-2">{children}</div>}
    </div>
  );
}

/** The group-info content, Messenger-anatomy: centered avatar + name up top,
 * collapsible Members / Add-people sections, and a leave icon-row at the
 * bottom. One shared body for the desktop rail and the mobile sheet. */
export function GroupInfoPanel({ group }: { group: ChatGroupDetail }) {
  const t = useTranslations('groups.info');
  const rename = useRenameGroup(group.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isOwner = group.myRole === 'owner';
  const name = group.name ?? '';

  const saveRename = () => {
    const next = draft.trim();
    if (!next || rename.isPending) return;
    rename.mutate(next, {
      onSuccess: () => setEditing(false),
      onError: () => toast.error(t('renameError')),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Identity block — centered, like tapping a group's name in Messenger. */}
      <div className="mb-3 flex shrink-0 flex-col items-center gap-1.5 pt-1">
        {editing ? (
          <form
            className="flex w-full items-center justify-center gap-2 px-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveRename();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={60}
              // biome-ignore lint/a11y/noAutofocus: entering rename mode is an explicit click
              autoFocus
              className="min-w-0 flex-1 border-[#E8E6DC] border-b bg-transparent pb-0.5 text-center font-bold font-sans-display text-[#141413] text-[16px] focus:border-[#141413] focus:outline-none"
            />
            <button
              type="submit"
              disabled={draft.trim().length === 0 || rename.isPending}
              className="shrink-0 font-medium font-sans-display text-[#141413] text-[12px] disabled:opacity-50"
            >
              {t('renameSave')}
            </button>
          </form>
        ) : (
          <span className="flex max-w-full items-center gap-1.5 px-2">
            <span className="truncate font-bold font-sans-display text-[#141413] text-[16px]">
              {name}
            </span>
            {isOwner && (
              <button
                type="button"
                aria-label={t('renameLabel')}
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#6E6D66] transition-colors hover:bg-[#141413]/[0.05] hover:text-[#141413]"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
          </span>
        )}
        <span className="font-sans-display text-[#6E6D66] text-[12px]">
          {t('memberCount', { count: group.members.length })}
        </span>
      </div>

      <Section title={t('membersHeading')}>
        <GroupMembersList group={group} />
      </Section>

      <Section title={t('addPeople')}>
        <GroupAddPeople group={group} />
      </Section>

      <div className="mt-auto shrink-0 border-[#E8E6DC] border-t pt-2">
        <GroupLeaveButton groupId={group.id} />
      </div>
    </div>
  );
}
