'use client';

import type { PortionSeat } from '@/components/groups/share-meal/portion-battery';
import { cn } from '@/lib/core/ui/cn';
import { MIN_PARTS, TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

interface PortionNotchProps {
  boundary: number;
  parts: number[];
  dishParts: number;
  leftParts: number;
  left: PortionSeat;
  right: PortionSeat;
  held: boolean;
  onPointerDown: () => void;
  onPointerMove: (clientX: number) => void;
  onPointerUp: () => void;
  onStep: (by: number) => void;
}

/**
 * One draggable boundary between two runs.
 *
 * Web has no haptics and no drag inertia, so the affordances it does have work
 * harder: `col-resize` on hover, the grip growing under the pointer, and — the
 * one that actually matters — a real `role="slider"` with arrow-key stepping.
 */
export function PortionNotch({
  parts,
  boundary,
  dishParts,
  leftParts,
  left,
  right,
  held,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onStep,
}: PortionNotchProps) {
  return (
    <div
      aria-label={`${left.label} và ${right.label}`}
      aria-valuemax={dishParts - MIN_PARTS}
      aria-valuemin={MIN_PARTS}
      aria-valuenow={parts[boundary]}
      aria-valuetext={`${left.label} ${parts[boundary]} phần, ${right.label} ${parts[boundary + 1]} phần`}
      className={cn(
        'absolute top-0 flex h-[56px] w-11 cursor-col-resize items-center justify-center',
        '-translate-x-1/2 focus-visible:outline-none'
      )}
      onKeyDown={(e) => {
        // Arrows move one part, shift jumps five, Home/End clamp.
        const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (by !== 0) {
          e.preventDefault();
          onStep(e.shiftKey ? by * 5 : by);
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          onStep(e.key === 'Home' ? -TOTAL_PARTS : TOTAL_PARTS);
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onPointerDown();
      }}
      onPointerMove={(e) => onPointerMove(e.clientX)}
      onPointerUp={onPointerUp}
      role="slider"
      style={{ left: `${(leftParts / dishParts) * 100}%` }}
      tabIndex={0}
    >
      <span
        className={cn(
          'block rounded-full border-[1.5px] border-kallo-text bg-white transition-all',
          // The grip is the only thing spanning the full shell, and it grows
          // past it under a pointer — a 12px bar among 12px cell gaps is
          // invisible otherwise.
          held ? 'h-[68px] w-[14px] shadow-lg' : 'h-[48px] w-[12px] shadow-sm'
        )}
      />
    </div>
  );
}
