'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/groups/profile-avatar';
import {
  useAcceptMealShareInvite,
  useDismissMealShareInvite,
  useMealShareInvites,
} from '@/hooks/social/use-meal-share-invites';
import type { MealShareInvite } from '@/lib/groups/client';

function formatKcal(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)} kcal`;
}

function formatG(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)}g`;
}

/** A portion fraction as "1/N" (0.5 → "1/2"). */
function portionLabel(factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || factor >= 1) {
    return '';
  }
  return `1/${Math.round(1 / factor)}`;
}

function InviteCard({ invite }: { invite: MealShareInvite }) {
  const t = useTranslations('groups.invites');
  const accept = useAcceptMealShareInvite();
  const dismiss = useDismissMealShareInvite();
  const na = t('na');
  const senderLabel = labelFor(invite.from);
  const busy = accept.isPending || dismiss.isPending;
  const portion = portionLabel(invite.portionFactor);

  const handleAccept = () => {
    if (busy) {
      return;
    }
    accept.mutate(invite.id, {
      onSuccess: () => toast.success(t('accepted')),
      onError: () => toast.error(t('error')),
    });
  };

  const handleDismiss = () => {
    if (busy) {
      return;
    }
    dismiss.mutate(invite.id, { onError: () => toast.error(t('error')) });
  };

  return (
    <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ProfileAvatar profile={invite.from} size="6" />
        <p className="font-sans-display text-[12px] text-nham-text">
          {invite.mode === 'split'
            ? t('sharedSplit', { name: senderLabel })
            : t('sharedCopy', { name: senderLabel })}
        </p>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="font-serif text-[17px] text-nham-text leading-relaxed">
          {invite.meal.rawInput}
        </p>
        {invite.mode === 'split' && portion && (
          <span className="mt-0.5 shrink-0 rounded-full bg-nham-accent/15 px-2 py-0.5 font-medium font-sans-display text-[10px] text-nham-text">
            {t('portion', { portion })}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between font-sans-display">
        <span className="text-[11px] text-nham-text-muted tabular-nums">
          P: {formatG(invite.meal.proteinG, na)}
          {'  '}C: {formatG(invite.meal.carbohydrateG, na)}
          {'  '}F: {formatG(invite.meal.fatG, na)}
        </span>
        <span className="font-bold text-nham-text text-sm tabular-nums">
          {formatKcal(invite.meal.caloriesKcal, na)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-nham-border/40 border-t border-dashed pt-3">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-nham-text-muted/80 transition-colors hover:bg-nham-hover/40 hover:text-nham-text disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          {t('dismiss')}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          aria-busy={accept.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-nham-accent/15 px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-nham-text transition-colors hover:bg-nham-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accept.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {t('accept')}
        </button>
      </div>
    </div>
  );
}

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
          className="font-sans-display text-[12px] text-nham-text-muted underline-offset-2 transition-colors hover:text-nham-text hover:underline disabled:opacity-60"
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
      <h2 className="font-medium font-sans-display text-[11px] text-nham-text-muted uppercase tracking-[0.08em]">
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
