'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CanvasLoader } from '@/components/shared/loaders/canvas-loader';
import { useTickerLine } from '@/components/shared/stream-ticker/use-ticker-line';
import { cn } from '@/lib/core/ui/cn';
import { loaderAt } from '@/lib/core/ui/loaders/registry';
import type { StreamTickerFrame } from '@/lib/domain/logging/stream-ticker';

interface StreamTickerProps {
  /** Null falls back to the generic analyzing verbs. */
  frame: StreamTickerFrame | null;
  /** Index into STREAM_LOADERS, picked once per meal and held for the run. */
  loaderIndex: number;
  className?: string;
}

/**
 * The ONE loading state while a meal analyses: a loader picked for this run and
 * a single line that flips through action verbs, then through dish names as
 * they are detected, then dishes with their calories.
 *
 * Shared by the dashboard's input bar and the logging feed so the two cannot
 * drift; the Flutter app runs the same line (`stream_ticker_line.dart`).
 */
export function StreamTicker({
  frame,
  loaderIndex,
  className,
}: StreamTickerProps) {
  const line = useTickerLine(frame);

  return (
    <div
      aria-live="polite"
      className={cn('flex min-w-0 items-center gap-3', className)}
    >
      {/* The brand brown: the loader and the verb beside it are the app
          working, so they carry the logo's umber rather than muted ink. */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-kallo-btn">
        <CanvasLoader spec={loaderAt(loaderIndex)} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 items-baseline gap-1">
        {line.prefix && (
          <span className="shrink-0 text-kallo-btn text-sm">{line.prefix}</span>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={line.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'min-w-0 truncate text-sm',
              line.kind === 'dish'
                ? 'font-serif text-kallo-text italic'
                : 'text-kallo-btn'
            )}
          >
            {line.text}
            {line.detail && (
              <span className="ml-1.5 font-sans text-kallo-text-muted not-italic tabular-nums">
                · {line.detail}
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
