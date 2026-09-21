'use client';

import { PartyPopper } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';

/**
 * A shared CHEAT meal's numbers, as its own kind of post.
 *
 * Before this, a cheat occasion in the circle feed was indistinguishable from
 * a weighed bowl of phở: same composition bar, same exact kcal figure. That
 * quietly misrepresented it twice over — it claimed a precision the logger
 * never had, and it hid what the meal was actually made of.
 *
 * What it takes to fix that turned out to be very little: the badge, and an
 * `≈` marking the figure as a placement rather than a measurement. The meal
 * text comes from the post above it.
 *
 * Deliberately NOT carried over from the owner's own card: the composition bar
 * (a segmented bar reads as measured proportions, the exact impression this
 * undoes), the P/C/F line (same problem, one decimal place further in), the
 * alcohol figure, the slider recap, and the reassurance line. A post is read at
 * a glance in someone else's scroll — four stacked number lines and two dot
 * scales is a report, and nobody is auditing a friend's buffet. The owner's own
 * card still carries all of it, which is where it belongs.
 */
export function CheatPostBody({ meal }: { meal: CircleFeedEntry['meal'] }) {
  const tCard = useTranslations('logging.cheatMealCard');
  const locale = useLocale();

  // The feed's own formatter, not the owner card's: cheat and precise posts
  // sit in one list, so a raw `1234` beside a localised `1.234` would read as
  // two different apps.
  const kcalLabel =
    meal.caloriesKcal == null
      ? '— kcal'
      : `≈ ${formatLocalizedNumber(meal.caloriesKcal, locale)} kcal`;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="flex w-fit items-center gap-1 rounded-full bg-kallo-accent/15 px-2 py-0.5 font-medium font-sans-display text-[10px] text-kallo-text">
        <PartyPopper className="h-3 w-3" />
        {tCard('badge')}
      </span>
      <span className="font-medium font-sans-display text-[15px] text-kallo-text tabular-nums">
        {kcalLabel}
      </span>
    </div>
  );
}
