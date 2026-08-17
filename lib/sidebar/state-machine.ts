/**
 * Sidebar state machine — the pure half of `useSidebarState`.
 *
 * States (mutually exclusive):
 *   - 'closed'  — rail is collapsed, no overlay
 *   - 'peeked'  — rail is ephemerally expanded as an overlay (entered via
 *                 hover or focus, exits when those gestures end)
 *   - 'open'    — rail is durably expanded (user pinned via toggle button)
 *
 * Orthogonal preference:
 *   - expandMode: 'click' | 'hover' — controls which gestures move between
 *     states. Mode itself never appears in the state name; it just gates
 *     transitions.
 *
 * Transition table:
 *   ┌──────────┬───────────────┬───────────────┬─────────────┬─────────────┐
 *   │ from \ ev│ pointerEnter  │ pointerLeave  │ togglePin   │ focus enter │
 *   ├──────────┼───────────────┼───────────────┼─────────────┼─────────────┤
 *   │ closed   │ →peeked (h)   │ —             │ →open       │ →peeked     │
 *   │ peeked   │ —             │ →closed       │ →open       │ —           │
 *   │ open     │ —             │ —             │ →closed     │ —           │
 *   └──────────┴───────────────┴───────────────┴─────────────┴─────────────┘
 *   (h) = only when expandMode === 'hover'
 *
 * Nothing here touches React, the DOM or the cookie jar: a transition only
 * *describes* what should happen (`persist`, `defer`) and the hook carries it
 * out. That split is what makes the table above directly testable — see
 * `__tests__/state-machine.test.ts`.
 */

import type {
  SidebarExpandMode,
  SidebarRestingState,
  SidebarState,
} from '@/lib/sidebar/types';

/** Hover dwell before a closed rail peeks open. */
export const PEEK_IN_DELAY_MS = 120;
/** Grace period before a peeked rail collapses again. */
export const PEEK_OUT_DELAY_MS = 240;

/** Everything outside the machine a transition is allowed to consult. */
export interface SidebarEnv {
  expandMode: SidebarExpandMode;
  /** `(pointer: fine)` — a coarse pointer must never peek. */
  finePointer: boolean;
  /** `(prefers-reduced-motion: reduce)` — peeks land instantly, undelayed. */
  reducedMotion: boolean;
}

export type SidebarEvent =
  | { type: 'pointerEnter' }
  | { type: 'pointerLeave' }
  | { type: 'focusEnter' }
  | { type: 'focusLeave' }
  | { type: 'togglePin' }
  | { type: 'setPinned'; collapsed: boolean }
  | { type: 'setExpandMode'; mode: SidebarExpandMode };

/** A delayed transition, applied only while the state is still `from`. */
export interface SidebarDeferred {
  from: SidebarState;
  to: SidebarState;
  delayMs: number;
}

export interface SidebarTransition {
  /** State to commit now — equal to the current state when nothing moves. */
  next: SidebarState;
  /** Write `next` to the resting-state cookie. Never true for 'peeked'. */
  persist: boolean;
  /** Arm this delayed transition after committing `next`. */
  defer: SidebarDeferred | null;
}

/**
 * Whether the machine listens to this event at all.
 *
 * A rejected event is inert in the strongest sense: the caller must not even
 * cancel a pending peek. That is what keeps a stray pointer drift over a
 * click-mode rail from collapsing a focus-peek out from under a keyboard user.
 */
export function acceptsSidebarEvent(
  event: SidebarEvent,
  env: SidebarEnv
): boolean {
  switch (event.type) {
    case 'pointerEnter':
      return env.expandMode === 'hover' && env.finePointer;
    case 'pointerLeave':
      return env.expandMode === 'hover';
    default:
      return true;
  }
}

/** Nothing moves: stay put, persist nothing, schedule nothing. */
function stay(state: SidebarState): SidebarTransition {
  return { next: state, persist: false, defer: null };
}

/** Settle on a resting state and write it to the cookie. */
function settle(next: SidebarRestingState): SidebarTransition {
  return { next, persist: true, defer: null };
}

/**
 * A peek in either direction: instant when the user opted out of motion,
 * otherwise scheduled so a passing cursor does not flicker the rail.
 */
function peek(
  from: SidebarState,
  to: SidebarState,
  delayMs: number,
  reducedMotion: boolean
): SidebarTransition {
  if (reducedMotion) return { next: to, persist: false, defer: null };
  return { next: from, persist: false, defer: { from, to, delayMs } };
}

/** The transition table above, as a function. Pure. */
export function sidebarTransition(
  state: SidebarState,
  event: SidebarEvent,
  env: SidebarEnv
): SidebarTransition {
  switch (event.type) {
    case 'pointerEnter':
      if (state !== 'closed') return stay(state);
      return peek('closed', 'peeked', PEEK_IN_DELAY_MS, env.reducedMotion);

    // Focus-peek is mode-agnostic: keyboard tabbing into a closed rail must
    // reveal labels, or keyboard users navigate invisible buttons.
    case 'focusEnter':
      return state === 'closed' ? stay('peeked') : stay(state);

    case 'pointerLeave':
    case 'focusLeave':
      if (state !== 'peeked') return stay(state);
      return peek('peeked', 'closed', PEEK_OUT_DELAY_MS, env.reducedMotion);

    case 'togglePin':
      return settle(state === 'open' ? 'closed' : 'open');

    case 'setPinned':
      return settle(event.collapsed ? 'closed' : 'open');

    case 'setExpandMode':
      // The mode comes off the event, not off `env`: the hook dispatches this
      // before its own expandMode state has re-rendered.
      if (event.mode === 'click') {
        // Switching to click while peeked locks the visual: peeked → open.
        return settle(state === 'peeked' ? 'open' : state);
      }
      // Hover mode at rest is closed; hover-in is the way to peek.
      return settle('closed');
  }
}
