'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/core/ui/cn';

/**
 * How high a panel stands over the camera — the approved levels, fractions of
 * the 844pt artboard from the top: a plain result leaves the photo its top
 * quarter; a dense one (the cup ruler, the other nutrients) rises one level;
 * the editor takes nearly all of it; a miss or the keypad hugs its content.
 */
export type ScanPanelLevel = 'result' | 'dense' | 'full' | 'fit';

const TOP: Record<Exclude<ScanPanelLevel, 'fit'>, string> = {
  result: `${(214 / 844) * 100}%`,
  dense: `${(140 / 844) * 100}%`,
  full: `${(54 / 844) * 100}%`,
};

/**
 * A sheet that rises INSIDE the scan dialog over the frozen camera — the
 * Flutter app's `ScanPanel`: canvas-coloured so the white cards separate by
 * surface, 34px corners concentric with the header's controls, a scrolling
 * body and an optional dock pinned under it.
 */
export function ScanPanel({
  level,
  header,
  children,
  dock,
  label,
}: {
  level: ScanPanelLevel;
  header: ReactNode;
  children: ReactNode;
  dock?: ReactNode;
  /** The panel's accessible name. */
  label: string;
}) {
  const fit = level === 'fit';
  return (
    <motion.section
      aria-label={label}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'absolute inset-x-0 bottom-0 flex flex-col rounded-t-[34px] bg-kallo-track shadow-[0_-8px_24px_rgba(20,20,19,0.12)]',
        fit && 'max-h-[94%]'
      )}
      style={fit ? undefined : { top: TOP[level] }}
    >
      {header}
      <div
        className={cn(
          'min-h-0 overflow-y-auto',
          fit ? 'shrink' : 'flex-1 px-4 pt-1 pb-4'
        )}
      >
        {children}
      </div>
      {dock && <div className="shrink-0 px-4 pt-2 pb-4">{dock}</div>}
    </motion.section>
  );
}
