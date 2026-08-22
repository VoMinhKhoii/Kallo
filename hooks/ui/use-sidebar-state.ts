'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseSidebarExpandMode,
  parseSidebarState,
  readSidebarCookie,
  SIDEBAR_EXPAND_MODE_COOKIE,
  SIDEBAR_STATE_COOKIE,
  writeSidebarCookie,
} from '@/lib/sidebar/cookies';
import {
  acceptsSidebarEvent,
  type SidebarEnv,
  type SidebarEvent,
  sidebarTransition,
} from '@/lib/sidebar/state-machine';
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
 * React binding for the sidebar's 3-state FSM.
 *
 * The transition table itself — states, gestures, delays — is
 * `lib/sidebar/state-machine.ts`. This hook only supplies the environment the
 * machine consults (two media queries), commits the state it returns, and
 * carries out the two effects a transition can ask for: a cookie write and a
 * delayed peek.
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

export function useSidebarState(
  options: UseSidebarStateOptions = {}
): UseSidebarStateResult {
  const { initialState = 'open', initialExpandMode = 'click' } = options;

  // Lazy initializers read the client cookie synchronously on first render
  // when SSR didn't provide a value (e.g., when used outside a server-
  // wrapped layout). This avoids the flash that a post-mount read would
  // cause. On the server, document is undefined and we use the prop default.
  const [state, setState] = useState<SidebarState>(
    () =>
      parseSidebarState(readSidebarCookie(SIDEBAR_STATE_COOKIE)) ?? initialState
  );
  const [expandMode, setExpandModeState] = useState<SidebarExpandMode>(
    () =>
      parseSidebarExpandMode(readSidebarCookie(SIDEBAR_EXPAND_MODE_COOKIE)) ??
      initialExpandMode
  );
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

  /** Run one event through the machine and carry out what it asks for. */
  const dispatch = useCallback(
    (event: SidebarEvent) => {
      const env: SidebarEnv = {
        expandMode,
        finePointer: prefersFinePointer(),
        reducedMotion: prefersReducedMotion(),
      };
      // A rejected event must not even cancel a pending peek.
      if (!acceptsSidebarEvent(event, env)) return;
      clearPeekTimer();
      setState((prev) => {
        const { next, persist, defer } = sidebarTransition(prev, event, env);
        if (persist) writeSidebarCookie(SIDEBAR_STATE_COOKIE, next);
        if (defer) {
          peekTimerRef.current = setTimeout(() => {
            setState((s) => (s === defer.from ? defer.to : s));
          }, defer.delayMs);
        }
        return next;
      });
    },
    [expandMode, clearPeekTimer]
  );

  const togglePinned = useCallback(
    () => dispatch({ type: 'togglePin' }),
    [dispatch]
  );
  const setPinnedCollapsed = useCallback(
    (next: boolean) => dispatch({ type: 'setPinned', collapsed: next }),
    [dispatch]
  );
  const setExpandMode = useCallback(
    (next: SidebarExpandMode) => {
      // Mode is not FSM state: commit it before the machine resolves the
      // sidebar state it implies (the event carries the new mode along).
      setExpandModeState(next);
      writeSidebarCookie(SIDEBAR_EXPAND_MODE_COOKIE, next);
      dispatch({ type: 'setExpandMode', mode: next });
    },
    [dispatch]
  );
  const onPointerEnter = useCallback(
    () => dispatch({ type: 'pointerEnter' }),
    [dispatch]
  );
  const onPointerLeave = useCallback(
    () => dispatch({ type: 'pointerLeave' }),
    [dispatch]
  );
  const onFocusEnter = useCallback(
    () => dispatch({ type: 'focusEnter' }),
    [dispatch]
  );
  const onFocusLeave = useCallback(
    () => dispatch({ type: 'focusLeave' }),
    [dispatch]
  );

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
