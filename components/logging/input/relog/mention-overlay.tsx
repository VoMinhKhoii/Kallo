'use client';

import type { RefObject } from 'react';
import type { MentionSegment } from '@/lib/logging/relog/mentions';

interface MentionOverlayProps {
  segments: MentionSegment[];
  /** Set by MealInput so the composer can keep the mirror's scroll in sync
   *  with the textarea once the text passes the 200px max height. */
  mirrorRef: RefObject<HTMLDivElement | null>;
}

/**
 * The blue behind the text.
 *
 * A `<textarea>` cannot colour part of its value, so the picked-dish tint comes
 * from this mirror: the textarea's own glyphs are made transparent and this
 * element paints an identical copy underneath, with mention runs in
 * `--kallo-mention`. Every typography and box property below MUST match the
 * textarea's, or the painted text drifts out of register with the real caret.
 *
 * The trailing zero-width space keeps a value ending in "\n" from collapsing
 * the mirror's last line, which would desync the scroll height.
 */
export function MentionOverlay({ segments, mirrorRef }: MentionOverlayProps) {
  return (
    <div
      ref={mirrorRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-1.5 font-[var(--font-dm-sans)] font-normal text-kallo-text text-sm leading-5"
    >
      {segments.map((segment, index) => (
        <span
          // Segments are positional runs, not entities — index is the identity.
          key={`${index}-${segment.isMention}`}
          className={segment.isMention ? 'text-kallo-mention' : undefined}
        >
          {segment.text}
        </span>
      ))}
      {'​'}
    </div>
  );
}
