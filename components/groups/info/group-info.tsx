'use client';

import { ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GroupInfoPanel } from '@/components/groups/info/group-info-panel';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type {
  ChatGroupDetail,
  ChatGroupMember,
} from '@/lib/chat-groups/client';

const COLLAPSED_KEY = 'kallo-group-info-collapsed';
const STACK_LIMIT = 5;

function AvatarStack({
  members,
  size,
}: {
  members: ChatGroupMember[];
  size: string;
}) {
  const shown = members.slice(0, STACK_LIMIT);
  const overflow = members.length - shown.length;
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((member) => (
        <ProfileAvatar
          key={member.userId}
          avatarUrl={member.avatarUrl}
          label={labelFor(member)}
          className={`${size} ring-2 ring-white`}
        />
      ))}
      {overflow > 0 && (
        <span
          className={`flex ${size} items-center justify-center rounded-full bg-[#E8E6DC] ring-2 ring-white`}
        >
          <span className="font-bold font-sans-display text-[#141413] text-[10px]">
            +{overflow}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * The group-info surface, Messenger-style, in two presentations:
 * - `wide:`+ (see --breakpoint-wide): a persistent rail portaled into the
 *   layout's `#circle-info-slot` at the right edge. The feed column is fixed
 *   to the viewport center there, so collapsing/expanding this rail (or the
 *   left nav) never moves the feed. Collapsible to a slim avatar strip
 *   (mirroring the left nav); the choice persists locally.
 * - below `wide:`: an in-flow avatar-stack trigger that opens the same panel
 *   in a right Sheet.
 */
export function GroupInfo({ group }: { group: ChatGroupDetail | undefined }) {
  const t = useTranslations('groups.info');
  const [collapsed, setCollapsed] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // Both reads are client-only: the slot div exists after first paint, and
  // reading localStorage during render would desync SSR markup.
  useEffect(() => {
    setSlot(document.getElementById('circle-info-slot'));
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1');
      return !current;
    });
  };

  if (!group || group.kind !== 'group') return null;

  const rail = (
    <div
      className="flex h-full min-h-0 flex-col rounded-xl border border-kallo-border/60 bg-white shadow-kallo-text/[0.03] shadow-sm transition-[width] duration-[220ms] ease-out"
      style={{ width: collapsed ? 56 : 304 }}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 py-3">
          <button
            type="button"
            aria-label={t('expand')}
            onClick={toggleCollapsed}
            className="flex size-8 items-center justify-center rounded-md text-kallo-text-muted transition-colors hover:bg-[#141413]/[0.06] hover:text-kallo-text"
          >
            <PanelRightOpen className="size-4" />
          </button>
          <div className="flex min-h-0 flex-col items-center gap-2 overflow-hidden">
            {group.members.slice(0, STACK_LIMIT).map((member) => (
              <ProfileAvatar
                key={member.userId}
                avatarUrl={member.avatarUrl}
                label={labelFor(member)}
                className="size-8"
              />
            ))}
            {group.members.length > STACK_LIMIT && (
              <span className="font-sans-display text-[#6E6D66] text-[10px]">
                +{group.members.length - STACK_LIMIT}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-end py-2 pr-2">
            <button
              type="button"
              aria-label={t('collapse')}
              onClick={toggleCollapsed}
              className="flex size-7 items-center justify-center rounded-md text-kallo-text-muted transition-colors hover:bg-[#141413]/[0.06] hover:text-kallo-text"
            >
              <PanelRightClose className="size-4" />
            </button>
          </div>
          <GroupInfoPanel group={group} />
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile/tablet: in-flow trigger + sheet. */}
      <div className="mb-2.5 flex wide:hidden shrink-0 items-center justify-end px-1">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={t('expand')}
              className="flex items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2 transition-colors hover:bg-[#141413]/[0.04]"
            >
              <AvatarStack members={group.members} size="size-6" />
              <ChevronRight className="size-3.5 text-[#6E6D66]" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-[88vw] max-w-[340px] flex-col gap-0 border-kallo-border/60 bg-white p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>{t('title')}</SheetTitle>
            </SheetHeader>
            <GroupInfoPanel group={group} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: the rail renders into the layout's in-flow slot. */}
      {slot && createPortal(rail, slot)}
    </>
  );
}
