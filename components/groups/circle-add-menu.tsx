'use client';

import { ChevronDown, UserPlus, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The single Circle header action: one button (a bare person-plus glyph on
 * phones, as in the Flutter header; brown and labelled from md) that opens a
 * small menu with the two creation paths. Each item opens the shared invite
 * dialog on the matching tab. Consolidates what used to be a header "Add friend" button plus
 * a "+ New" switcher pill into one control.
 */
export function CircleAddMenu() {
  const t = useTranslations('groups.page');
  const [tab, setTab] = useState<'friend' | 'group' | null>(null);
  const { locked, requirePremium } = usePremiumGuard();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Phones get the Flutter Circle header's bare person-plus glyph;
              from md up it is the brown labelled button. */}
          <button
            type="button"
            aria-label={t('addFriend')}
            className="inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-xl text-kallo-text transition-colors hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface md:size-auto md:bg-kallo-btn md:px-3 md:py-2 md:text-white md:hover:bg-kallo-btn/90"
          >
            <UserPlus
              className="size-6 md:size-3.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className="hidden font-medium font-sans-display text-[12px] md:inline">
              {t('addFriend')}
            </span>
            <ChevronDown
              className="hidden h-3.5 w-3.5 opacity-80 md:block"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-44 border-[#E8E6DC] bg-white"
        >
          <DropdownMenuItem
            onSelect={() => {
              if (!requirePremium('unlimited_circle')) return;
              setTab('group');
            }}
            className="gap-2 font-sans-display text-[#141413] text-[13px]"
          >
            <Users2 className="h-4 w-4" />
            {t('createGroup')}
            {locked('unlimited_circle') && <PremiumChip className="ml-auto" />}
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
