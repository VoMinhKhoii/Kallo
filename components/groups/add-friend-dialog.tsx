'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CircleList } from './invite/circle-list';
import { InviteLinkSection } from './invite/invite-link-section';

interface AddFriendDialogProps {
  /** The control that opens the dialog (e.g. a button). */
  trigger: ReactNode;
}

/**
 * The invite surface: your shareable link (with an editable end) plus your
 * circle. No username, no search, no requests — people connect by opening your
 * link and tapping Accept.
 */
export function AddFriendDialog({ trigger }: AddFriendDialogProps) {
  const t = useTranslations('groups.invite');

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="gap-5 border-nham-border/60 bg-nham-surface">
        <DialogHeader>
          <DialogTitle
            className="text-nham-text text-xl"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('title')}
          </DialogTitle>
          <DialogDescription
            className="text-nham-text-muted"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <InviteLinkSection />

        <div className="max-h-[40vh] overflow-y-auto">
          <CircleList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
