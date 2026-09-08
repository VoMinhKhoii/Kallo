'use client';

import { Copy, Heart, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useLogSharedMeal } from '@/hooks/social/sharing/use-log-shared-meal';
import { useToggleReaction } from '@/hooks/social/sharing/use-toggle-reaction';
import { Link } from '@/i18n/navigation';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import { cn } from '@/lib/core/ui/cn';
import { circleThreadHref } from '@/lib/domain/social/circle-routes';

/** A portion factor as the glyph people read (½, ⅓, ¼), else a percentage. */
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
  // Spelled once: the bar and the figures under it read the same record.
  const grams = {
    protein: meal.proteinG,
    carbohydrate: meal.carbohydrateG,
    fat: meal.fatG,
  };
  const composition = compositionFromGrams(grams);
  // Nothing measured at all — draw nothing rather than a row of dashes over an
  // empty bar.
  const hasNutrition = meal.caloriesKcal != null || composition.totalKcal > 0;
  // Same formatter the grams beside it use (MacroScale), so one legend row
  // never mixes a raw `1234` with a localised `1.234`.
  const kcalLabel =
    meal.caloriesKcal == null
      ? '— kcal'
      : `${formatLocalizedNumber(meal.caloriesKcal, locale)} kcal`;
  // A count only ever reaches the eye when there is one; the label carries it
  // for the reader who cannot see the figure beside the glyph.
  const reactionCount = entry.reactions.count;
  const heartLabel =
    reactionCount > 0 ? `${t('heart')} ${reactionCount}` : t('heart');
  const replyLabel =
    entry.repliesTotal > 0 ? `${t('reply')} ${entry.repliesTotal}` : t('reply');

  return (
    <div className="flex gap-3">
      <ProfileAvatar avatarUrl={friend.avatarUrl} label={label} />
      <div className="min-w-0 flex-1">
        <div className="mb-[3px] flex flex-wrap items-baseline gap-2">
          <b className="font-bold font-sans-display text-[15px] text-kallo-text">
            {label}
          </b>
          {/* A backfilled meal (logged for a past date) is shared "now", so its
              elapsed time would misleadingly read "just now" — hide it. */}
          {!meal.isBackfilled && (
            <span className="font-sans-display text-[15px] text-kallo-text-muted">
              {formatElapsed(meal.sharedAt, locale)}
            </span>
          )}
          {meal.portionFactor < 1 && (
            <span className="rounded-full bg-kallo-border/60 px-2 py-px font-medium font-sans-display text-[10px] text-kallo-text-muted">
              {t('portion', {
                portion: fractionLabel(meal.portionFactor),
              })}
            </span>
          )}
        </div>
        <p className="font-medium font-sans-display text-[15px] text-kallo-text leading-[1.45]">
          {capitalizeFirst(meal.rawInput)}
        </p>
        {hasNutrition && (
          <div className="mt-2.5 flex flex-col gap-1">
            {composition.totalKcal > 0 && (
              <CompositionBar
                segments={composition.segments}
                variant="compact"
              />
            )}
            {/* Meal-text size, under the bar, leading the legend — the same
                anatomy as mobile's MealBlock, where kcal is `dashBody()` at the
                head of a spaceBetween row. Figure and unit are ONE string
                (mobile's `fmtKcal`), so the two can never wrap apart. */}
            <MacroScale
              grams={grams}
              leading={
                <span className="font-medium font-sans-display text-[15px] text-kallo-text tabular-nums">
                  {kcalLabel}
                </span>
              }
            />
          </div>
        )}
        <div className="mt-2.5 flex items-center gap-[18px] font-sans-display text-[11.5px] text-kallo-text-muted tabular-nums">
          <button
            type="button"
            aria-label={heartLabel}
            aria-pressed={entry.reactions.mine}
            disabled={toggleReaction.isPending}
            onClick={() => toggleReaction.mutate(meal.shareId)}
            className={cn(
              'inline-flex items-center gap-1.5 transition-colors disabled:opacity-50',
              entry.reactions.mine && 'text-kallo-text'
            )}
          >
            {/* A hearted post has to look hearted from across the row; at
                ink it was the same near-black as the glyph beside it. The
                request was "red filled", and each platform satisfies it out of
                its OWN palette — mobile's `danger` (#D11A1A), web's
                `--kallo-danger` (terracotta). Web bans pure red outright, so a
                literal #D11A1A here was mobile's token smuggled onto the web
                canvas, not a shared value. */}
            <Heart
              className={cn(
                'size-[15px]',
                entry.reactions.mine && 'fill-kallo-danger text-kallo-danger'
              )}
            />
            {/* Zero reads as a scoreboard on a post nobody has answered —
                Threads shows the glyph alone until there is a figure. The
                reply glyph beside it already hid its own 0; the heart was the
                one holdout. */}
            {reactionCount > 0 && <span>{reactionCount}</span>}
          </button>
          {/* The thread lives on the post's own page, not under the card: a
              feed row that carries its replies stops being one glanceable post.
              A count on the glyph is what says there is anything to open. */}
          <Link
            href={circleThreadHref(meal.shareId)}
            aria-label={replyLabel}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-kallo-text"
          >
            <MessageCircle className="size-[15px]" />
            {entry.repliesTotal > 0 && <span>{entry.repliesTotal}</span>}
          </Link>
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
                className="inline-flex items-center gap-1.5 transition-colors hover:text-kallo-text disabled:opacity-50"
              >
                <Copy className="size-[15px]" />
                <span>{t('logCopy')}</span>
              </button>
              {copyLocked && <PremiumChip className="px-1.5 py-0" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
