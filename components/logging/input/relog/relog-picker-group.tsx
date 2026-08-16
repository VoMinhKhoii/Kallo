'use client';

import { RelogPickerOption } from '@/components/logging/input/relog/relog-picker-option';
import type { RelogCandidate } from '@/lib/logging/relog/relog';

interface RelogPickerGroupProps {
  label: string;
  candidates: RelogCandidate[];
  /** Where this group's first row sits in the picker's flat option list — the
   *  keyboard state machine indexes that list, so the header is skipped for
   *  free rather than needing to be made unfocusable. */
  offset: number;
  highlighted: number;
  listboxId: string;
  onHighlight: (index: number) => void;
  onSelect: (candidate: RelogCandidate) => void;
}

/** One labelled group of the `/` picker (MÓN or BỮA ĂN). Renders nothing when
 *  empty, so a query that only matches dishes shows no meals header. */
export function RelogPickerGroup({
  label,
  candidates,
  offset,
  highlighted,
  listboxId,
  onHighlight,
  onSelect,
}: RelogPickerGroupProps) {
  if (candidates.length === 0) return null;

  return (
    <>
      <div
        aria-hidden
        className="px-3 pt-1.5 pb-1 font-sans-display text-[11px] text-kallo-text-muted/60 uppercase tracking-wide"
      >
        {label}
      </div>
      {candidates.map((candidate, idx) => {
        const index = offset + idx;
        return (
          <RelogPickerOption
            key={`${candidate.kind}-${candidate.sourceMealId}-${
              candidate.kind === 'dish' ? candidate.mealItemOrder : 'meal'
            }`}
            candidate={candidate}
            id={`${listboxId}-${index}`}
            isHighlighted={index === highlighted}
            onHighlight={() => onHighlight(index)}
            onSelect={() => onSelect(candidate)}
          />
        );
      })}
    </>
  );
}
