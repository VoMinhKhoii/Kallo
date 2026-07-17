'use client';

import { Copy, Heart, Split } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { tintFor } from '@/components/groups/avatar-tint';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { useLogSharedMeal } from '@/hooks/social/use-log-shared-meal';
import { useToggleReaction } from '@/hooks/social/use-toggle-reaction';
import { formatElapsed } from '@/lib/date/format-elapsed';
import type { CircleFeedEntry } from '@/lib/groups/client';
import { cn } from '@/lib/utils';

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
  const { friend, meal } = entry;

  const label = entry.isSelf ? tWall('you') : labelFor(friend);
  const na = tWall('na');
  const protein = formatMacro(meal.proteinG, na);
  const carbs = formatMacro(meal.carbohydrateG, na);
  const fat = formatMacro(meal.fatG, na);
  const calories = formatCalories(meal.caloriesKcal, na);

  return (
    <div className="flex gap-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tintFor(friend.avatarSeed, label)}`}
      >
        <span className="font-bold font-sans-display text-[12px] text-nham-btn">
          {label.charAt(0).toUpperCase()}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-baseline gap-2">
          <b className="font-bold font-sans-display text-[13px] text-nham-text">
            {label}
          </b>
          <span className="font-sans-display text-[11px] text-nham-text-muted">
            {formatElapsed(meal.sharedAt, locale)}
          </span>
          {meal.portionFactor < 1 && (
            <span className="rounded-full bg-nham-accent/15 px-2 py-px font-medium font-sans-display text-[10px] text-nham-text-muted">
              {t('portion', {
                portion: fractionLabel(meal.portionFactor),
              })}
            </span>
          )}
        </div>
        <p className="font-medium font-sans-display text-[15px] text-nham-text leading-[1.45]">
          {meal.rawInput}
        </p>
        <div className="mt-2.5 flex items-center justify-between font-sans-display text-[11px] text-nham-text-muted tabular-nums">
          {/* flex gap, not literal spaces — HTML collapses those to one. */}
          <span className="flex items-center gap-2.5">
            <span>P: {protein}</span>
            <span>C: {carbs}</span>
            <span>F: {fat}</span>
          </span>
          <b className="font-bold text-[13px] text-nham-text">{calories}</b>
        </div>
        <div className="mt-2.5 flex items-center gap-[18px] font-sans-display text-[11.5px] text-nham-text-muted tabular-nums">
          <button
            type="button"
            aria-label={t('heart')}
            aria-pressed={entry.reactions.mine}
            disabled={toggleReaction.isPending}
            onClick={() => toggleReaction.mutate(meal.shareId)}
            className={cn(
              'inline-flex items-center gap-1.5 transition-colors disabled:opacity-50',
              entry.reactions.mine && 'text-nham-accent'
            )}
          >
            <Heart
              className={cn(
                'size-[15px]',
                entry.reactions.mine && 'fill-nham-accent'
              )}
            />
            <span>{entry.reactions.count}</span>
          </button>
          {!entry.isSelf && (
            <>
              <button
                type="button"
                disabled={logSharedMeal.isPending}
                onClick={() =>
                  logSharedMeal.mutate({ shareId: meal.shareId, factor: 1 })
                }
                className="inline-flex items-center gap-1.5 transition-colors hover:text-nham-text disabled:opacity-50"
              >
                <Copy className="size-[15px]" />
                <span>{t('logCopy')}</span>
              </button>
              <button
                type="button"
                disabled={logSharedMeal.isPending}
                onClick={() =>
                  logSharedMeal.mutate({ shareId: meal.shareId, factor: 0.5 })
                }
                className="inline-flex items-center gap-1.5 transition-colors hover:text-nham-text disabled:opacity-50"
              >
                <Split className="size-[15px]" />
                <span>{t('logHalf')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
