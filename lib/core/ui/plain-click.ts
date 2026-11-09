import type { MouseEvent } from 'react';

/**
 * Whether a click on a link should be handled in place. Cmd, Ctrl, Shift and
 * middle clicks keep their browser meaning (new tab, new window).
 */
export function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
