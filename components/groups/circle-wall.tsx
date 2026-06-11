'use client';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CircleEmpty } from '@/components/groups/circle-empty';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { useCircleFeed } from '@/hooks/use-circle-feed';
import type { CircleFeedEntry } from '@/lib/groups/client';

function formatMacro(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)}g`;
}

function formatCalories(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)} kcal`;
}

/**
 * One friend's most-recent shared meal for today. Read-only clone of the
 * persisted-meal-card aesthetic — timeline dot, Lora dish quote, collapsible
 * macros. No likes, no counts, no badges, no leaderboards.
 */
function CircleCard({ entry }: { entry: CircleFeedEntry }) {
  const t = useTranslations('groups.wall');
  const locale = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { friend, meal } = entry;

  const timeLabel = new Date(meal.sharedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const na = t('na');
  const calories = formatCalories(meal.caloriesKcal, na);
  const protein = formatMacro(meal.proteinG, na);
  const carbs = formatMacro(meal.carbohydrateG, na);
  const fat = formatMacro(meal.fatG, na);

  const friendLabel = labelFor(friend);

  return (
    <motion.article
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="group relative"
    >
      {/* Timeline dot & line */}
      <div className="absolute top-2 bottom-0 -left-4 w-px bg-nham-border/60 group-last:bg-transparent sm:-left-10" />
      <div className="absolute top-2 -left-5 h-2 w-2 rounded-full border-2 border-nham-accent bg-white sm:-left-[43px]" />

      {/* Friend identity */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
          <span
            className="font-bold text-[10px] text-nham-btn"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {friendLabel.charAt(0).toUpperCase()}
          </span>
        </span>
        <span
          className="text-[12px] text-nham-text"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {friendLabel}
        </span>
        <span
          className="text-[11px] text-nham-text-muted/60"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('sharedAt', { time: timeLabel })}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[17px] text-nham-text leading-relaxed sm:text-[19px]"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {meal.rawInput}
          </p>
          <button
            type="button"
            aria-label={t('toggleDetails')}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-full p-1 text-nham-text-muted/60 transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Collapsed summary */}
        <AnimatePresence initial={false}>
          {isCollapsed && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-2 flex items-center justify-between"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              <span className="text-[11px] text-nham-text-muted tabular-nums">
                P: {protein}
                {'  '}C: {carbs}
                {'  '}F: {fat}
              </span>
              <span className="font-bold text-nham-text text-sm tabular-nums">
                {calories}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-5 border-nham-border/50 border-t border-dashed pt-3">
                <div className="flex items-center justify-between">
                  <span
                    className="font-bold text-[13px] text-nham-text"
                    style={{ fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {t('total')}
                  </span>
                  <div className="flex items-center gap-4">
                    <span
                      className="text-[11px] text-nham-text-muted tabular-nums"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      P: {protein}
                      {'  '}C: {carbs}
                      {'  '}F: {fat}
                    </span>
                    <span
                      className="font-bold text-nham-text tabular-nums"
                      style={{ fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {calories}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/**
 * The ambient Circle wall: most-recent-per-friend, today only, capped and
 * NON-scrollable (the feed is already bounded server-side). Read-only and
 * badge-free by design — never a global newsfeed.
 */
export function CircleWall() {
  const {
    data: feed = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useCircleFeed();

  if (isPending) {
    return <CircleWallSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  if (feed.length === 0) {
    return <CircleEmpty />;
  }

  return (
    <div className="space-y-6 pl-4 sm:pl-10">
      {feed.map((entry) => (
        <CircleCard key={entry.friend.userId} entry={entry} />
      ))}
    </div>
  );
}
