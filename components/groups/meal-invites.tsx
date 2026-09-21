'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import {
  useAcceptMealShareInvite,
  useDismissMealShareInvite,
  useMealShareInvites,
  useStageCheatMealShareInvite,
} from '@/hooks/social/sharing/use-meal-share-invites';
import { useRouter } from '@/i18n/navigation';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';
import { toLocalDayKey } from '@/lib/core/date/day-key';

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
  const router = useRouter();
  const accept = useAcceptMealShareInvite();
  const stageCheat = useStageCheatMealShareInvite();
  const dismiss = useDismissMealShareInvite();
  const na = t('na');
  const senderLabel = labelFor(invite.from);
  const isCheat = invite.meal.entryMode === 'cheat';
  const busy = accept.isPending || stageCheat.isPending || dismiss.isPending;
  const portion = portionLabel(invite.portionFactor);

  const handleAccept = () => {
    if (busy) {
      return;
    }
    // A cheat offer is not "add this meal" — nobody can say what I ate from
    // where THEY put the sliders. Taking it reopens their spec on my own
    // logging feed, on the day the meal was eaten, and I set my amounts there.
    if (isCheat) {
      stageCheat.mutate(invite.id, {
        onSuccess: (staged) => {
          router.push(
            `/logging?date=${toLocalDayKey(
              Date.parse(staged.loggedAt),
              new Date().getTimezoneOffset()
            )}`
          );
        },
        onError: () => toast.error(t('error')),
      });
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
    <div className="rounded-2xl border border-kallo-border/60 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ProfileAvatar
          avatarUrl={invite.from.avatarUrl}
          label={senderLabel}
          className="size-6"
        />
        <p className="font-sans-display text-[12px] text-kallo-text">
          {isCheat
            ? t('sharedCheat', { name: senderLabel })
            : invite.mode === 'split'
              ? t('sharedSplit', { name: senderLabel })
              : t('sharedCopy', { name: senderLabel })}
        </p>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <p className="font-serif text-[17px] text-kallo-text leading-relaxed">
          {invite.meal.rawInput}
        </p>
        {invite.mode === 'split' && portion && (
          <span className="mt-0.5 shrink-0 rounded-full bg-kallo-hover px-2 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text">
            {t('portion', { portion })}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between font-sans-display">
        <span className="text-[11px] text-kallo-text-muted tabular-nums">
          P: {formatG(invite.meal.proteinG, na)}
          {'  '}C: {formatG(invite.meal.carbohydrateG, na)}
          {'  '}F: {formatG(invite.meal.fatG, na)}
        </span>
        <span className="font-bold text-kallo-text text-sm tabular-nums">
          {formatKcal(invite.meal.caloriesKcal, na)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-kallo-border/40 border-t border-dashed pt-3">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text-muted/80 transition-colors hover:bg-kallo-hover/40 hover:text-kallo-text disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          {t('dismiss')}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          aria-busy={accept.isPending || stageCheat.isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-kallo-hover px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text transition-colors hover:bg-kallo-hover/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accept.isPending || stageCheat.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {isCheat ? t('acceptCheat') : t('accept')}
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
