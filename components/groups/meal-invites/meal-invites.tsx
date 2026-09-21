'use client';

import { useTranslations } from 'next-intl';
import { InviteDeck } from '@/components/groups/meal-invites/invite-deck';
import { useMealShareInvites } from '@/hooks/social/sharing/use-meal-share-invites';

/**
 * The Circle inbox: pending copy/split offers addressed to me. Renders nothing
 * when empty (no empty-state chrome above the wall). Accepting drops the meal
 * into the day it was eaten; dismissing clears the offer.
 *
 * The offers render as a deck, not a list — see `InviteDeck`. Since only the
 * front one is on screen, the heading carries the count: it is the one place
 * that says how many are waiting, and a screen reader hears it before reaching
 * the single set of buttons below.
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
        {invites.length > 1 && (
          // The leading space is a real `{' '}`, not the newline above it —
          // JSX drops whitespace between adjacent expressions, and an
          // accessible name computed from these children would otherwise come
          // out glued: "Shared with you· 3 waiting". `ml-1.5` is visual only.
          <>
            {' '}
            <span className="tabular-nums">
              {t('waiting', { count: invites.length })}
            </span>
          </>
        )}
      </h2>
      <InviteDeck invites={invites} />
    </section>
  );
}
