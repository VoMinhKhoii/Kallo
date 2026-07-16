'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';

/** Number of placeholder cards shown while the circle feed loads. */
const SKELETON_COUNT = 3;

/**
 * Loading state for a Circle thread (FriendsFeed / GroupFeed). Mirrors
 * CircleCard's bubble/photo-card geometry so the layout doesn't shift when
 * real data arrives, and prevents a flash of the empty state during the
 * initial fetch.
 */
export function CircleWallSkeleton() {
  const t = useTranslations('groups.wall');
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
      className="flex flex-col gap-4"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.08 }}
          className="w-[270px] overflow-hidden rounded-3xl border border-nham-border/60 bg-white shadow-sm sm:w-[300px]"
        >
          {/* Photo placeholder */}
          <div className="aspect-square w-full animate-pulse bg-nham-border/30" />

          {/* Macro footer */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 animate-pulse rounded bg-nham-border/30" />
              <div className="h-3.5 w-14 animate-pulse rounded bg-nham-border/40" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
