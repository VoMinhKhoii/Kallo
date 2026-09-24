'use client';

import { Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { labelFor } from '@/components/groups/invite/profile-identity';
import {
  InviteConfirmDialog,
  type InviteConfirmKind,
} from '@/components/shared/invite-confirm/invite-confirm-dialog';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import {
  useAcceptMealShareInvite,
  useDismissMealShareInvite,
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

export function InviteCard({ invite }: { invite: MealShareInvite }) {
  const t = useTranslations('groups.invites');
  const router = useRouter();
  const accept = useAcceptMealShareInvite();
  const stageCheat = useStageCheatMealShareInvite();
  const dismiss = useDismissMealShareInvite();
  const na = t('na');
  const senderLabel = labelFor(invite.from);
  const { locked, requirePremium } = usePremiumGuard();
  const isCheat = invite.meal.entryMode === 'cheat';
  const accepting = accept.isPending || stageCheat.isPending;
  const busy = accepting || dismiss.isPending;
  const portion = portionLabel(invite.portionFactor);
  // Taking a cheat offer is a cheat WRITE, which is gated. Chip it before the
  // tap, so a free user meets the paywall instead of an error toast telling
  // them to try again at something that can never work.
  const cheatLocked = isCheat && locked('cheat_meal');
  const [confirming, setConfirming] = useState<InviteConfirmKind | null>(null);

  /** Land on the day the meal actually arrived on, which is the day it was
   *  EATEN and usually not today — see copy-meal-verbatim's mealSlot option. */
  const openLandedDay = (isoInstant: string) => {
    const day = toLocalDayKey(
      Date.parse(isoInstant),
      new Date().getTimezoneOffset()
    );
    router.push(`/logging?date=${day}`);
  };

  // Both buttons only ASK; the confirm dialog is what acts. A cheat offer
  // meets the paywall before the question, not after the reader has said yes.
  const requestAccept = () => {
    if (isCheat && !requirePremium('cheat_meal')) return;
    setConfirming(isCheat ? 'acceptCheat' : 'accept');
  };

  const confirm = (kind: InviteConfirmKind) => {
    if (busy) {
      return;
    }
    // A cheat offer is not "add this meal" — nobody can say what I ate from
    // where THEY put the sliders. Taking it reopens their spec on my own
    // logging feed, on the day the meal was eaten, and I set my amounts there.
    if (kind === 'acceptCheat') {
      stageCheat.mutate(invite.id, {
        onSuccess: (staged) => openLandedDay(staged.loggedAt),
        onError: () => toast.error(t('error')),
      });
      return;
    }
    if (kind === 'dismiss') {
      dismiss.mutate(invite.id, { onError: () => toast.error(t('error')) });
      return;
    }
    accept.mutate(invite.id, {
      // The copy lands at the SOURCE meal's instant, so "added to your diary"
      // used to point at a day the user was not on and would not find. Take
      // them there, the way the cheat path does.
      onSuccess: (saved) => {
        toast.success(t('accepted'));
        openLandedDay(saved.meal.loggedAt);
      },
      onError: () => toast.error(t('error')),
    });
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
          onClick={() => setConfirming('dismiss')}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text-muted/80 transition-colors hover:bg-kallo-hover/40 hover:text-kallo-text disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          {t('dismiss')}
        </button>
        <button
          type="button"
          onClick={requestAccept}
          disabled={busy}
          aria-busy={accepting}
          className="inline-flex items-center gap-1.5 rounded-full bg-kallo-hover px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text transition-colors hover:bg-kallo-hover/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {accepting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {isCheat ? t('acceptCheat') : t('accept')}
        </button>
        {cheatLocked && <PremiumChip />}
      </div>

      <InviteConfirmDialog
        kind={confirming}
        senderLabel={senderLabel}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        onConfirm={confirm}
      />
    </div>
  );
}
