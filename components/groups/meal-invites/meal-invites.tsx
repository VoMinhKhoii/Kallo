'use client';

import { useTranslations } from 'next-intl';
import { InviteCard } from '@/components/groups/meal-invites/invite-card';
import { useMealShareInvites } from '@/hooks/social/sharing/use-meal-share-invites';

/**
 * The Circle inbox: pending copy/split offers addressed to me. Renders nothing
 * when empty (no empty-state chrome above the wall). Accepting drops the meal
 * into today's diary; dismissing clears the offer.
 */
export function MealInvites() {
  const t = useTranslations('groups.invites');
  const {
    data: invites = [],
    isError,
    isFetching,
    refetch,
  } = useMealShareInvites();

  // Distinguish a failed fetch from "no invites" — silence here would hide
  // meals a friend actually sent. A quiet retry line, never a heavy card.
  if (isError) {
    return (
      <section>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="font-sans-display text-[12px] text-kallo-text-muted underline-offset-2 transition-colors hover:text-kallo-text hover:underline disabled:opacity-60"
        >
          {t('loadError')}
        </button>
      </section>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium font-sans-display text-[11px] text-kallo-text-muted uppercase tracking-[0.08em]">
        {t('title')}
      </h2>
      <div className="space-y-3">
        {invites.map((invite) => (
          <InviteCard key={invite.id} invite={invite} />
        ))}
      </div>
    </section>
  );
}
