'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseSidebarExpandMode,
  parseSidebarState,
  SIDEBAR_EXPAND_MODE_COOKIE,
  SIDEBAR_STATE_COOKIE,
  writeSidebarCookie,
} from '@/lib/sidebar/cookies';
import type {
  SidebarExpandMode,
  SidebarRestingState,
  SidebarState,
} from '@/lib/sidebar/types';

export type {
  SidebarExpandMode,
  SidebarRestingState,
  SidebarState,
} from '@/lib/sidebar/types';

/**
 * Sidebar state machine — explicit 3-state FSM.
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
 * Persistence: only the *resting* state ('closed' | 'open') is persisted,
 * plus the expandMode. 'peeked' is ephemeral by definition. Storage is
 * cookies, not localStorage — so the server can read them and render the
 * correct first paint with no flash. See `lib/sidebar/cookies.ts`.
 *
 * Hydration: server passes `initialState` and `initialExpandMode` from
 * cookies. The hook starts there and never needs a "pre-hydration null"
 * guard. The `hydrated` flag is still exposed for consumers that want to
 * suppress motion on the very first paint.
 */

const PEEK_IN_DELAY_MS = 120;
const PEEK_OUT_DELAY_MS = 240;

export interface UseSidebarStateOptions {
  /** SSR-provided initial resting state (read from cookie in app layout). */
  initialState?: SidebarRestingState;
  /** SSR-provided initial expand mode. */
  initialExpandMode?: SidebarExpandMode;
}

export interface UseSidebarStateResult {
  /** Raw FSM state — primarily for tests and advanced consumers. */
  state: SidebarState;
  /** True when the rail's resting state is 'closed' (i.e., user has it
   *  pinned closed, regardless of any active peek). */
  pinnedCollapsed: boolean;
  /** True iff state === 'peeked'. */
  peeking: boolean;
  /** True iff the rail should render in its narrow form. */
  effectiveCollapsed: boolean;
  /** True after the first client paint. */
  hydrated: boolean;
  /** Persisted gesture preference. */
  expandMode: SidebarExpandMode;
  /** Switch expand mode (persisted). Resolves to a coherent state per FSM. */
  setExpandMode: (next: SidebarExpandMode) => void;
  /** Toggle pinned: closed/peeked → open ; open → closed. */
  togglePinned: () => void;
  /** Set pinned state explicitly. */
  setPinnedCollapsed: (next: boolean) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocusEnter: () => void;
  onFocusLeave: () => void;
}

function prefersFinePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: fine)').matches;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Read a cookie value by name, client-side only. */
function readCookieClient(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function useSidebarState(
  options: UseSidebarStateOptions = {}
): UseSidebarStateResult {
  const { initialState = 'open', initialExpandMode = 'click' } = options;

  // Lazy initializer reads the client cookie synchronously on first render
  // when SSR didn't provide a value (e.g., when used outside a server-
  // wrapped layout). This avoids the flash that a post-mount read would
  // cause. On the server, document is undefined and we use the prop default.
  const [state, setState] = useState<SidebarState>(() => {
    const cookieValue = parseSidebarState(
      readCookieClient(SIDEBAR_STATE_COOKIE)
    );
    return cookieValue ?? initialState;
  });
  const [expandMode, setExpandModeState] = useState<SidebarExpandMode>(() => {
    const cookieValue = parseSidebarExpandMode(
      readCookieClient(SIDEBAR_EXPAND_MODE_COOKIE)
    );
    return cookieValue ?? initialExpandMode;
  });
  const [hydrated, setHydrated] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const clearPeekTimer = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }, []);

  /** Persist only the resting state — never 'peeked'. */
  const persistRestingState = useCallback((s: SidebarState) => {
    if (s === 'peeked') return;
    writeSidebarCookie(SIDEBAR_STATE_COOKIE, s);
  }, []);

  // ─── Transitions ─────────────────────────────────────────────────────────

  const setPinnedCollapsed = useCallback(
    (next: boolean) => {
      clearPeekTimer();
      const target: SidebarRestingState = next ? 'closed' : 'open';
      setState(target);
      persistRestingState(target);
    },
    [clearPeekTimer, persistRestingState]
  );

  const togglePinned = useCallback(() => {
    clearPeekTimer();
    setState((prev) => {
      // closed/peeked → open ; open → closed.
      const next: SidebarRestingState = prev === 'open' ? 'closed' : 'open';
      persistRestingState(next);
      return next;
    });
  }, [clearPeekTimer, persistRestingState]);

  const setExpandMode = useCallback(
    (next: SidebarExpandMode) => {
      // Cancel any in-flight peek before changing the rules of the world.
      clearPeekTimer();
      setExpandModeState(next);
      writeSidebarCookie(SIDEBAR_EXPAND_MODE_COOKIE, next);

      if (next === 'click') {
        // Switching to click while peeked locks the visual: peeked → open.
        setState((prev) => {
          const target: SidebarRestingState =
            prev === 'peeked' ? 'open' : (prev as SidebarRestingState);
          persistRestingState(target);
          return target;
        });
        return;
      }
      // Switching to hover always returns to the resting closed state.
      // Hover mode at rest = closed; hover-in is the way to peek.
      setState('closed');
      persistRestingState('closed');
    },
    [clearPeekTimer, persistRestingState]
  );

  // ─── Pointer / focus event handlers ──────────────────────────────────────

  const onPointerEnter = useCallback(() => {
    // Peek-in only valid: hover mode + currently closed + fine pointer.
    if (expandMode !== 'hover') return;
    if (!prefersFinePointer()) return;
    clearPeekTimer();
    setState((prev) => {
      if (prev !== 'closed') return prev;
      if (prefersReducedMotion()) return 'peeked';
      // Schedule async transition.
      peekTimerRef.current = setTimeout(() => {
        setState((s) => (s === 'closed' ? 'peeked' : s));
      }, PEEK_IN_DELAY_MS);
      return prev;
    });
  }, [expandMode, clearPeekTimer]);

  const onPointerLeave = useCallback(() => {
    // Pointer leaves only matter in hover mode. In click mode, pointer
    // events must not touch the FSM at all — focus-peek owns peek lifecycle.
    if (expandMode !== 'hover') return;
    clearPeekTimer();
    setState((prev) => {
      if (prev !== 'peeked') return prev;
      if (prefersReducedMotion()) return 'closed';
      peekTimerRef.current = setTimeout(() => {
        setState((s) => (s === 'peeked' ? 'closed' : s));
      }, PEEK_OUT_DELAY_MS);
      return prev;
    });
  }, [expandMode, clearPeekTimer]);

  // Focus-peek is mode-agnostic: keyboard tabbing into a closed rail must
  // reveal labels. Otherwise keyboard users navigate invisible buttons.
  const onFocusEnter = useCallback(() => {
    clearPeekTimer();
    setState((prev) => (prev === 'closed' ? 'peeked' : prev));
  }, [clearPeekTimer]);

  const onFocusLeave = useCallback(() => {
    clearPeekTimer();
    setState((prev) => {
      if (prev !== 'peeked') return prev;
      if (prefersReducedMotion()) return 'closed';
      peekTimerRef.current = setTimeout(() => {
        setState((s) => (s === 'peeked' ? 'closed' : s));
      }, PEEK_OUT_DELAY_MS);
      return prev;
    });
  }, [clearPeekTimer]);

  // ─── Keyboard shortcut ───────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'b' && e.key !== 'B') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      togglePinned();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePinned]);

  useEffect(() => () => clearPeekTimer(), [clearPeekTimer]);

  // ─── Derived projections ─────────────────────────────────────────────────

  const peeking = state === 'peeked';
  // pinnedCollapsed describes the *resting* state — peeked counts as closed.
  const pinnedCollapsed = state !== 'open';
  const effectiveCollapsed = state === 'closed';

  return {
    state,
    pinnedCollapsed,
    peeking,
    effectiveCollapsed,
    hydrated,
    expandMode,
    setExpandMode,
    togglePinned,
    setPinnedCollapsed,
    onPointerEnter,
    onPointerLeave,
    onFocusEnter,
    onFocusLeave,
  };
}
