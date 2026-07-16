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
  /** The control that opens the dialog (e.g. a button). */
  trigger: ReactNode;
  /** Which tab to open on first render. */
  defaultTab?: DialogTab;
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
}: AddFriendDialogProps) {
  const t = useTranslations('groups.invite');
  const tGroup = useTranslations('groups.createGroup');
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DialogTab>(defaultTab);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 border-nham-border/60 bg-nham-surface">
        <DialogHeader>
          <DialogTitle className="font-serif text-nham-text text-xl">
            {tab === 'friend' ? t('title') : tGroup('title')}
          </DialogTitle>
          <DialogDescription className="font-sans-display text-nham-text-muted">
            {tab === 'friend' ? t('description') : tGroup('description')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as DialogTab)}>
          <TabsList className="w-full rounded-xl bg-nham-hover/40 p-1">
            <TabsTrigger
              value="friend"
              className="flex-1 font-sans-display text-[13px] text-nham-text-muted data-[state=active]:bg-white data-[state=active]:text-nham-text"
            >
              {t('tabAddFriend')}
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="flex-1 font-sans-display text-[13px] text-nham-text-muted data-[state=active]:bg-white data-[state=active]:text-nham-text"
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
            <CreateGroupForm onCreated={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
