'use client';

import { motion } from 'motion/react';

/** Number of placeholder cards shown while the circle feed loads. */
const SKELETON_COUNT = 3;

/**
 * Loading state for the Circle wall. Mirrors the timeline + card geometry of
 * CircleCard so the layout doesn't shift when real data arrives, and prevents a
 * flash of the empty state during the initial fetch.
 */
export function CircleWallSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your circle"
      className="space-y-6 pl-4 sm:pl-10"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.08 }}
          className="relative"
        >
          {/* Timeline dot & line — matches CircleCard geometry */}
          <div className="absolute top-2 bottom-0 -left-4 w-px bg-nham-border/60 sm:-left-10" />
          <div className="absolute top-2 -left-5 h-2 w-2 rounded-full border-2 border-nham-border bg-white sm:-left-[43px]" />

          {/* Friend identity row */}
          <div className="mb-2 flex items-center gap-2">
            <div className="size-6 shrink-0 animate-pulse rounded-full bg-nham-border/40" />
            <div className="h-3 w-24 animate-pulse rounded-md bg-nham-border/40" />
            <div className="h-2.5 w-14 animate-pulse rounded-md bg-nham-border/30" />
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 w-3/5 animate-pulse rounded-md bg-nham-border/40" />
              <div className="size-6 shrink-0 animate-pulse rounded-full bg-nham-border/30" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="h-3 w-28 animate-pulse rounded bg-nham-border/30" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-nham-border/40" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
