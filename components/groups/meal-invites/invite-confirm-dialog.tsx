'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Which response to a meal-share offer is being confirmed. `null` = closed. */
export type InviteConfirmKind = 'accept' | 'acceptCheat' | 'dismiss';

/**
 * The one confirm in front of every response to a meal-share offer — the
 * Circle deck card and the Activity row both open it.
 *
 * Both responses are hard to take back from the reader's side: an accept
 * writes a meal into their diary (on the day it was EATEN, usually not today),
 * a cheat accept spends the offer on a slider card, and a dismiss removes the
 * offer until the sender re-shares it. The dismiss copy says exactly that, so
 * the reader knows it is not permanent and that the sender is not told.
 *
 * Controlled rather than trigger-wrapped: the card decides whether to open it
 * at all (a busy card, or a cheat offer the paywall intercepts, never asks).
 */
export function InviteConfirmDialog({
  kind,
  senderLabel,
  onOpenChange,
  onConfirm,
}: {
  kind: InviteConfirmKind | null;
  senderLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (kind: InviteConfirmKind) => void;
}) {
  const t = useTranslations('groups.invites.confirm');
  // The last kind opened, kept while the dialog animates out — closing sets
  // `kind` to null on the first frame, and falling back to a default there
  // would flash the accept copy over a dismiss for the length of the fade.
  const [shown, setShown] = useState<InviteConfirmKind>(kind ?? 'accept');
  if (kind && kind !== shown) setShown(kind);
  const destructive = shown === 'dismiss';

  return (
    <AlertDialog open={kind !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-sans-display text-[18px]">
            {t(`${shown}Title`)}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
            {t(`${shown}Description`, { name: senderLabel })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'ghost' : 'default'}
            className={
              destructive
                ? 'text-kallo-danger hover:bg-transparent hover:text-kallo-danger'
                : undefined
            }
            onClick={() => {
              if (kind) onConfirm(kind);
            }}
          >
            {t(`${shown}Action`)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
