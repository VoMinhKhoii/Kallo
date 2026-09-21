'use client';

import { Copy, Heart, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { FeedEntryIdentity } from '@/components/groups/feed/feed-entry-identity';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { CompositionBar } from '@/components/shared/nutrition/composition-bar';
import { MacroScale } from '@/components/shared/nutrition/macro-scale';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useLogSharedMeal } from '@/hooks/social/sharing/use-log-shared-meal';
import { useToggleReaction } from '@/hooks/social/sharing/use-toggle-reaction';
import { Link } from '@/i18n/navigation';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { capitalizeFirst } from '@/lib/core/text/capitalize';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import { cn } from '@/lib/core/ui/cn';
import { circleThreadHref } from '@/lib/domain/social/circle-routes';

/** A glyph's label carries its figure only when there is one. The count lives
 * IN the label because the figure beside the glyph is drawn for the eye alone:
 * a screen reader must hear "Reply 3", not a bare "Reply". */
function withCount(label: string, count: number): string {
  return count > 0 ? `${label} ${count}` : label;
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
  const isCheat = meal.entryMode === 'cheat';
  // A cheat occasion's figures were placed on a slider, not measured. The `≈`
  // is what says so on the number itself; the chip says it about the post. The
  // anatomy around them is the ordinary one — it is still a meal someone ate,
  // and giving it a different shape made it harder to read, not more honest.
  const kcalLabel =
    meal.caloriesKcal == null
      ? '— kcal'
      : `${isCheat ? '≈ ' : ''}${formatLocalizedNumber(meal.caloriesKcal, locale)} kcal`;
  const reactionCount = entry.reactions.count;
  const heartLabel = withCount(t('heart'), reactionCount);
  const replyLabel = withCount(t('reply'), entry.repliesTotal);

  return (
    <div className="flex gap-3">
      <ProfileAvatar avatarUrl={friend.avatarUrl} label={label} />
      <div className="min-w-0 flex-1">
        <FeedEntryIdentity label={label} meal={meal} />
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
          {/* Split half is still deferred — it needs a confirmation step.
              Hidden for a cheat post: it has no item rows to reproduce, so the
              server refuses it (log-shared.ts) and the button was a guaranteed
              error. A cheat meal travels as a directed invite instead, where
              the recipient can set their own amounts. */}
          {!(entry.isSelf || meal.entryMode === 'cheat') && (
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
