import type { ReactNode } from 'react';
import { TimeDivider } from '@/components/logging/feed/turn/time-divider';
import { UserMessageBubble } from '@/components/logging/feed/turn/user-message-bubble';

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
