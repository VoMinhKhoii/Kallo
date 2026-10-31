interface ClickModifiers {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * True for an ordinary left click. A link that opens something in place
 * (the settings dialog) handles only these and lets cmd/ctrl/shift/middle
 * clicks fall through to the browser, which opens its href in a new tab.
 */
export function isPlainLeftClick(event: ClickModifiers): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
