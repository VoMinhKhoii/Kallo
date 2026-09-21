'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CheatChip } from '@/components/groups/feed/cheat-chip';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { formatElapsed } from '@/lib/core/date/format-elapsed';

/** A split share as the fraction it actually was. */
function fractionLabel(factor: number): string {
  if (Math.abs(factor - 0.5) < 0.001) {
    return '½';
  }
  if (Math.abs(factor - 1 / 3) < 0.001) {
    return '⅓';
  }
  if (Math.abs(factor - 0.25) < 0.001) {
    return '¼';
  }
  return `${Math.round(factor * 100)}%`;
}

/**
 * A post's first line: who shared it, when, and what kind of meal it is.
 *
 * Split out of `FeedEntry` when the cheat chip joined it — the row had grown
 * four independent rules about what appears beside a name (author, time or
 * not, split fraction, meal kind), which is a concern of its own and not
 * something the post's layout should be carrying.
 *
 * Everything that qualifies the post lives here, at the trailing edge and off
 * the reading path of the name and the meal text below. The meal's own figures
 * belong to the nutrition block. Flutter twin: `feed_entry_identity.dart`.
 */
export function FeedEntryIdentity({
  meal,
  label,
}: {
  meal: CircleFeedEntry['meal'];
  /** Already resolved to "You" or the friend's label by the caller. */
  label: string;
}) {
  const t = useTranslations('groups.feed');
  const locale = useLocale();

  return (
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
          {t('portion', { portion: fractionLabel(meal.portionFactor) })}
        </span>
      )}
      {meal.entryMode === 'cheat' && <CheatChip />}
    </div>
  );
}
