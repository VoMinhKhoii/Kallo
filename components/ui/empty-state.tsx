import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** A single Lucide glyph, drawn thin inside a soft accent disc. */
  icon?: LucideIcon;
  title: string;
  /** One quiet supporting line — keep it to a sentence. */
  description?: string;
  /** Action buttons row (e.g. a primary + secondary <Button>). Optional. */
  children?: ReactNode;
  /** Tighter spacing + smaller type for panels, drawers, and card widgets
   *  where the full-size state would overwhelm the layout. */
  compact?: boolean;
  className?: string;
}

/**
 * The app's canonical empty state: a centered icon-title-description column
 * with an optional action row. Warm and quiet by default (Apple-Notes-on-cream,
 * not a loud dashboard placeholder). Use it wherever a list, search, or feed
 * comes back empty. Pair actions with the shared <Button> so callers get a way
 * forward (invite, refresh, clear filters). See the `compact` prop for
 * constrained surfaces.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-16',
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-nham-accent/10 text-nham-accent',
            compact ? 'size-9' : 'size-12'
          )}
        >
          <Icon className={compact ? 'size-4' : 'size-5'} strokeWidth={1.5} />
        </span>
      )}
      <div className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-1')}>
        <p
          className={cn(
            'font-medium font-sans-display text-nham-text',
            compact ? 'text-[13px]' : 'text-[15px]'
          )}
        >
          {title}
        </p>
        {description && (
          <p
            className={cn(
              'mx-auto max-w-xs font-sans-display text-nham-text-muted leading-relaxed',
              compact ? 'text-[12px]' : 'text-[13px]'
            )}
          >
            {description}
          </p>
        )}
      </div>
      {children && (
        <div
          className={cn(
            'flex items-center justify-center gap-2',
            compact ? 'mt-1' : 'mt-2'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
