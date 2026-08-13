import type { ReactNode } from 'react';
import { TimeDivider } from '@/components/logging/feed/time-divider';

/**
 * The user's meal, as a sent chat message.
 *
 * Umber (`nham-btn`), not the tan accent: this bubble carries running text, and
 * the palette rule is that tan "survives only on non-text moments" and never
 * colours running text. Tan would also fail contrast against the cream
 * (2.1:1); umber clears AA at 5.9:1.
 */
export function UserMessageBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-[18px] rounded-br-md bg-nham-btn px-3.5 py-2.5 font-sans-display text-[13px] text-nham-surface leading-relaxed">
        {text}
      </p>
    </div>
  );
}

interface TurnHeaderProps {
  timeLabel: string;
  /**
   * The user's typed words. Null or blank for meals with nothing to quote — a
   * barcode scan, say — which then show the divider alone.
   */
  message?: string | null;
  /** Extra content for the divider itself, e.g. the fractional-portion chip. */
  children?: ReactNode;
}

/**
 * What opens one meal in the feed: the time it was logged, then the user's own
 * words as a sent message.
 *
 * Every meal wears this — saved, staged, or still analysing — so the day reads
 * as one conversation rather than as a chat that turns into a list the moment
 * something is saved. The card below keeps its own serif quote; the repetition
 * is a deliberate, temporary choice, matching the Flutter app.
 */
export function TurnHeader({ timeLabel, message, children }: TurnHeaderProps) {
  const text = message?.trim();
  return (
    <>
      <TimeDivider timeLabel={timeLabel}>{children}</TimeDivider>
      {text && (
        <div className="mb-3">
          <UserMessageBubble text={text} />
        </div>
      )}
    </>
  );
}
