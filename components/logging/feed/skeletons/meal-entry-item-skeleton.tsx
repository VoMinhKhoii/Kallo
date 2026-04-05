import { motion } from 'motion/react';

interface MealEntryItemSkeletonProps {
  index: number;
  /** If provided, show the real item name instead of a placeholder bar */
  name?: string;
}

export function MealEntryItemSkeleton({
  index,
  name,
}: MealEntryItemSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex items-center justify-between py-2.5 text-[13px]"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Left: item name or placeholder */}
      <div className="flex min-w-0 items-center gap-2">
        {name ? (
          <span className="truncate font-medium text-nham-text">{name}</span>
        ) : (
          <div
            className="h-3.5 animate-pulse rounded-md bg-nham-border/40"
            style={{ width: `${80 + index * 20}px` }}
          />
        )}
      </div>

      {/* Right: skeleton macros + calories */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2">
          <div className="h-3 w-6 animate-pulse rounded bg-nham-border/30" />
          <div className="h-3 w-6 animate-pulse rounded bg-nham-border/30" />
          <div className="h-3 w-6 animate-pulse rounded bg-nham-border/30" />
        </div>
        <div className="h-3.5 w-12 animate-pulse rounded bg-nham-border/40" />
      </div>
    </motion.div>
  );
}
