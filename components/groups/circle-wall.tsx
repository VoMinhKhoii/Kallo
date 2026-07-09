'use client';

import { Soup } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { CircleEmpty } from '@/components/groups/circle-empty';
import { CircleError } from '@/components/groups/circle-error';
import { CirclePresenceStrip } from '@/components/groups/circle-presence-strip';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import type { CircleFeedEntry } from '@/lib/groups/client';
import { cn } from '@/lib/utils';

function formatMacro(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)}g`;
}

function formatCalories(value: number | null, na: string): string {
  return value == null ? na : `${Math.round(value)} kcal`;
}

/** Compact "Xm/Xh/Xd ago" for the photo-card time badge — Intl handles the
 * locale (English "1h ago" vs Vietnamese "1 giờ trước") for free. */
function formatElapsed(iso: string, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: 'always',
    style: 'narrow',
  });
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

// No real food photos yet (deliberate placeholder, not a general product
// pattern — Nhẩm is otherwise photograph-free by design). A warm, deterministic
// gradient stands in per meal so the thread doesn't read as a wall of
// identical grey boxes once photo capture ships.
const PHOTO_PLACEHOLDER_TINTS = [
  'from-[#e3c99a] via-[#d4a876] to-[#b98a5c]', // golden hour
  'from-[#cbb89e] via-[#b39c81] to-[#8f7a63]', // taupe
  'from-[#ddd2c0] via-[#c4b6a0] to-[#a4917a]', // stone
] as const;

function photoPlaceholderTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PHOTO_PLACEHOLDER_TINTS[Math.abs(hash) % PHOTO_PLACEHOLDER_TINTS.length];
}

/**
 * One friend's most-recent shared meal for today. Read-only clone of the
 * persisted-meal-card aesthetic — Lora dish quote, collapsible macros. No
 * likes, no counts, no badges, no leaderboards.
 *
 * `align`: 'timeline' keeps the original single-column ambient-wall look
 * (a connecting dot/line down the left edge — see CircleWall below). 'left'
 * / 'right' drop the timeline and render as a chat bubble instead, for views
 * that mix the actor's own entry in with friends' (own on the right, like an
 * ordinary chat thread).
 */
export function CircleCard({
  entry,
  align = 'timeline',
}: {
  entry: CircleFeedEntry;
  align?: 'timeline' | 'left' | 'right';
}) {
  const t = useTranslations('groups.wall');
  const locale = useLocale();
  const { friend, meal } = entry;
  const isBubble = align !== 'timeline';
  const isRight = align === 'right';

  const timeLabel = new Date(meal.sharedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const na = t('na');
  const calories = formatCalories(meal.caloriesKcal, na);
  const protein = formatMacro(meal.proteinG, na);
  const carbs = formatMacro(meal.carbohydrateG, na);
  const fat = formatMacro(meal.fatG, na);

  // The actor's own table reads as "You"/"Bạn"; everyone else by their label.
  const friendLabel = entry.isSelf ? t('you') : labelFor(friend);

  // Shared macro summary — same copy in both layouts, just repositioned
  // (under the dish quote in timeline mode, under the photo in bubble mode).
  const macroSummary = (
    <div className="flex items-center justify-between font-sans-display">
      <span className="text-[11px] text-nham-text-muted tabular-nums">
        P: {protein}
        {'  '}C: {carbs}
        {'  '}F: {fat}
      </span>
      <span className="font-bold text-nham-text text-sm tabular-nums">
        {calories}
      </span>
    </div>
  );

  if (isBubble) {
    const elapsedLabel = formatElapsed(meal.sharedAt, locale);
    const photoTint = photoPlaceholderTint(meal.mealId);

    return (
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'w-[270px] shrink-0 overflow-hidden rounded-3xl border border-nham-border/60 bg-white shadow-sm sm:w-[300px]',
          isRight && 'ml-auto'
        )}
      >
        {/* Placeholder photo — no real food photos yet, see comment above */}
        <div
          className={cn(
            'relative aspect-square w-full overflow-hidden bg-gradient-to-br',
            photoTint
          )}
        >
          <div className="-top-6 -right-6 absolute h-24 w-24 rounded-full bg-white/25 blur-2xl" />
          <div className="-bottom-8 -left-8 absolute h-28 w-28 rounded-full bg-black/10 blur-2xl" />
          <Soup
            className="absolute inset-0 m-auto h-9 w-9 text-white/50"
            strokeWidth={1.5}
          />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
            <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-black/35 py-1 pr-2.5 pl-1 backdrop-blur-sm">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/90">
                <span className="font-bold font-sans-display text-[9px] text-nham-btn">
                  {friendLabel.charAt(0).toUpperCase()}
                </span>
              </span>
              <span className="truncate font-medium font-sans-display text-[11px] text-white">
                {friendLabel}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-black/35 px-2 py-1 font-sans-display text-[10px] text-white backdrop-blur-sm">
              {elapsedLabel}
            </span>
          </div>

          <div className="absolute inset-x-2 bottom-2">
            <p className="truncate rounded-full bg-black/35 px-3 py-1.5 font-sans-display text-[12px] text-white backdrop-blur-sm">
              {meal.rawInput}
            </p>
          </div>
        </div>

        {/* Macro footer */}
        <div className="p-3">{macroSummary}</div>
      </motion.article>
    );
  }

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
          <span className="font-bold font-sans-display text-[10px] text-nham-btn">
            {friendLabel.charAt(0).toUpperCase()}
          </span>
        </span>
        <span className="font-sans-display text-[12px] text-nham-text">
          {friendLabel}
        </span>
        <span className="font-sans-display text-[11px] text-nham-text-muted/60">
          {t('sharedAt', { time: timeLabel })}
        </span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
        <p className="font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
          {meal.rawInput}
        </p>
        <div className="mt-2">{macroSummary}</div>
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

  const sharedTodayUserIds = new Set(feed.map((entry) => entry.friend.userId));

  return (
    <div>
      <CirclePresenceStrip sharedTodayUserIds={sharedTodayUserIds} />
      {feed.length === 0 ? (
        <CircleEmpty />
      ) : (
        <div className="space-y-6 pl-4 sm:pl-10">
          {feed.map((entry) => (
            <CircleCard key={entry.friend.userId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
