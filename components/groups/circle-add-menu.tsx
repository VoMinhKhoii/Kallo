'use client';

import { ChevronDown, UserPlus, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The single Circle header action: one brown button that opens a small menu
 * with the two creation paths. Each item opens the shared invite dialog on the
 * matching tab. Consolidates what used to be a header "Add friend" button plus
 * a "+ New" switcher pill into one control.
 */
export function CircleAddMenu() {
  const t = useTranslations('groups.page');
  const [tab, setTab] = useState<'friend' | 'group' | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-kallo-btn px-3 py-2 text-white transition-colors hover:bg-kallo-btn/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="font-medium font-sans-display text-[12px]">
              {t('addFriend')}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-44 border-[#E8E6DC] bg-white"
        >
          <DropdownMenuItem
            onSelect={() => setTab('group')}
            className="gap-2 font-sans-display text-[#141413] text-[13px]"
          >
            <Users2 className="h-4 w-4" />
            {t('createGroup')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setTab('friend')}
            className="gap-2 font-sans-display text-[#141413] text-[13px]"
          >
            <UserPlus className="h-4 w-4" />
            {t('addFriend')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {tab && (
        <AddFriendDialog
          defaultTab={tab}
          open
          onOpenChange={(next) => {
            if (!next) setTab(null);
          }}
        />
      )}
    </>
  );
}
