'use client';

import { Copy, Heart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ShareReplies } from '@/components/groups/share-replies';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useLogSharedMeal } from '@/hooks/social/sharing/use-log-shared-meal';
import { useToggleReaction } from '@/hooks/social/sharing/use-toggle-reaction';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import { cn } from '@/lib/core/ui/cn';

function formatMacro(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)}g`;
}

function formatCalories(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)} kcal`;
}

function fractionLabel(factor: number): string {
  if (Math.abs(factor - 0.5) < 0.001) return '½';
  if (Math.abs(factor - 1 / 3) < 0.001) return '⅓';
  if (Math.abs(factor - 0.25) < 0.001) return '¼';
  return `${Math.round(factor * 100)}%`;
}

/** One flat Threads-style meal post with portion and share-scoped actions. */
export function FeedEntry({ entry }: { entry: CircleFeedEntry }) {
  const tWall = useTranslations('groups.wall');
  const t = useTranslations('groups.feed');
  const locale = useLocale();
  const toggleReaction = useToggleReaction();
  const logSharedMeal = useLogSharedMeal();
  const { requirePremium, locked } = usePremiumGuard();
  const { friend, meal } = entry;
  // Pulling a copy off someone else's post is an INITIATED copy — the billable
  // side of copy/split. Responding to a directed invite stays free.
  const copyLocked = locked('copy_split');

  const label = entry.isSelf ? tWall('you') : labelFor(friend);
  const na = tWall('na');
  const protein = formatMacro(meal.proteinG, na);
  const carbs = formatMacro(meal.carbohydrateG, na);
  const fat = formatMacro(meal.fatG, na);
  const calories = formatCalories(meal.caloriesKcal, na);

  return (
    <div className="flex gap-3">
      <ProfileAvatar avatarUrl={friend.avatarUrl} label={label} />
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-baseline gap-2">
          <b className="font-bold font-sans-display text-[#141413] text-[15px]">
            {label}
          </b>
          {/* A backfilled meal (logged for a past date) is shared "now", so its
              elapsed time would misleadingly read "just now" — hide it. */}
          {!meal.isBackfilled && (
            <span className="font-sans-display text-[#6E6D66] text-[15px]">
              {formatElapsed(meal.sharedAt, locale)}
            </span>
          )}
          {meal.portionFactor < 1 && (
            <span className="rounded-full bg-[#E8E6DC]/60 px-2 py-px font-medium font-sans-display text-[#6E6D66] text-[10px]">
              {t('portion', {
                portion: fractionLabel(meal.portionFactor),
              })}
            </span>
          )}
        </div>
        <p className="font-medium font-sans-display text-[#141413] text-[15px] leading-[1.45]">
          {meal.rawInput}
        </p>
        <div className="mt-2.5 flex items-center justify-between font-sans-display text-[#6E6D66] text-[11px] tabular-nums">
          {/* flex gap, not literal spaces — HTML collapses those to one. */}
          <span className="flex items-center gap-2.5">
            <span>P: {protein}</span>
            <span>C: {carbs}</span>
            <span>F: {fat}</span>
          </span>
          <b className="font-bold text-[#141413] text-[13px]">{calories}</b>
        </div>
        <div className="mt-2.5 flex items-center gap-[18px] font-sans-display text-[#6E6D66] text-[11.5px] tabular-nums">
          <button
            type="button"
            aria-label={t('heart')}
            aria-pressed={entry.reactions.mine}
            disabled={toggleReaction.isPending}
            onClick={() => toggleReaction.mutate(meal.shareId)}
            className={cn(
              'inline-flex items-center gap-1.5 transition-colors disabled:opacity-50',
              entry.reactions.mine && 'text-[#141413]'
            )}
          >
            <Heart
              className={cn(
                'size-[15px]',
                entry.reactions.mine && 'fill-[#141413]'
              )}
            />
            <span>{entry.reactions.count}</span>
          </button>
          {/* Split half is still deferred — it needs a confirmation step. */}
          {!entry.isSelf && (
            <>
              <button
                type="button"
                disabled={logSharedMeal.isPending}
                onClick={() => {
                  if (!requirePremium('copy_split')) return;
                  logSharedMeal.mutate({ shareId: meal.shareId, factor: 1 });
                }}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-[#141413] disabled:opacity-50"
              >
                <Copy className="size-[15px]" />
                <span>{t('logCopy')}</span>
              </button>
              {copyLocked && <PremiumChip className="px-1.5 py-0" />}
            </>
          )}
        </div>
        <ShareReplies
          shareId={meal.shareId}
          replies={entry.replies}
          repliesTotal={entry.repliesTotal}
        />
      </div>
    </div>
  );
}
