'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CircleList } from './invite/circle-list';
import { CreateGroupForm } from './invite/create-group-form';
import { InviteLinkSection } from './invite/invite-link-section';

type DialogTab = 'friend' | 'group';

interface AddFriendDialogProps {
  /** The control that opens the dialog. Omit when driving `open` externally
   *  (e.g. from a dropdown-menu item). */
  trigger?: ReactNode;
  /** Which tab to open on each open. */
  defaultTab?: DialogTab;
  /** Controlled open state. When provided, the dialog is externally driven and
   *  `trigger` is optional. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The invite surface, switching between two tabs:
 * - Add friend: your shareable link (with an editable end) plus your circle.
 *   No username, no search, no requests — people connect by opening your link
 *   and tapping Accept.
 * - Create group: name a group chat and add members from your circle (no
 *   invite-link path for groups — members must already be accepted friends).
 */
export function AddFriendDialog({
  trigger,
  defaultTab = 'friend',
  open: controlledOpen,
  onOpenChange,
}: AddFriendDialogProps) {
  const t = useTranslations('groups.invite');
  const tGroup = useTranslations('groups.createGroup');
  const [internalOpen, setInternalOpen] = useState(false);
  const [tab, setTab] = useState<DialogTab>(defaultTab);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // Re-seed the tab on every open — the dialog stays mounted between opens, so
  // opening it from the "Create group" menu item must land on that tab each
  // time, not whatever tab the user last left it on.
  function handleOpenChange(next: boolean) {
    if (next) setTab(defaultTab);
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="gap-5 border-[#E8E6DC] bg-nham-surface">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#141413] text-xl">
            {tab === 'friend' ? t('title') : tGroup('title')}
          </DialogTitle>
          <DialogDescription className="font-sans-display text-[#6E6D66]">
            {tab === 'friend' ? t('description') : tGroup('description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as DialogTab)}>
          <TabsList className="w-full rounded-xl bg-[#E8E6DC]/60 p-1">
            <TabsTrigger
              value="friend"
              className="flex-1 rounded-lg py-1.5 font-medium font-sans-display text-[#6E6D66] text-[13px] transition-colors data-[state=active]:bg-white data-[state=active]:text-[#141413] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-[#E8E6DC]"
            >
              {t('tabAddFriend')}
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="flex-1 rounded-lg py-1.5 font-medium font-sans-display text-[#6E6D66] text-[13px] transition-colors data-[state=active]:bg-white data-[state=active]:text-[#141413] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-[#E8E6DC]"
            >
              {t('tabCreateGroup')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friend" className="space-y-5">
            <InviteLinkSection />
            <div className="max-h-[40vh] overflow-y-auto">
              <CircleList />
            </div>
          </TabsContent>

          <TabsContent value="group">
            <CreateGroupForm
              onCreated={() => handleOpenChange(false)}
              onAddFriend={() => setTab('friend')}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
