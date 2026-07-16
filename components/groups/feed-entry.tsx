'use client';

import { useLocale, useTranslations } from 'next-intl';
import { tintFor } from '@/components/groups/avatar-tint';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { formatElapsed } from '@/lib/date/format-elapsed';
import type { CircleFeedEntry } from '@/lib/groups/client';

function formatMacro(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)}g`;
}

function formatCalories(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)} kcal`;
}

/** One flat Threads-style feed post: a tinted disc, a head row (label +
 * relative time), the dish line, and a macros row. No actions, portion pill,
 * photo, or motion — this is the v1 anatomy; interactions land in a later PR. */
export function FeedEntry({ entry }: { entry: CircleFeedEntry }) {
  const t = useTranslations('groups.wall');
  const locale = useLocale();
  const { friend, meal } = entry;

  const label = entry.isSelf ? t('you') : labelFor(friend);
  const na = t('na');
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
        <div className="mb-[3px] flex items-baseline gap-2">
          <b className="font-bold font-sans-display text-[13px] text-nham-text">
            {label}
          </b>
          <span className="font-sans-display text-[11px] text-nham-text-muted">
            {formatElapsed(meal.sharedAt, locale)}
          </span>
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
      </div>
    </div>
  );
}
