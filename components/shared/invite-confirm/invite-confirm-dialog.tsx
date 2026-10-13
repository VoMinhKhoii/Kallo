'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';

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

  return (
    <ConfirmDialog
      open={kind !== null}
      onOpenChange={onOpenChange}
      title={t(`${shown}Title`)}
      description={t(`${shown}Description`, { name: senderLabel })}
      confirmLabel={t(`${shown}Action`)}
      cancelLabel={t('cancel')}
      tone={shown === 'dismiss' ? 'destructive' : 'default'}
      onConfirm={() => {
        if (kind) onConfirm(kind);
      }}
    />
  );
}
