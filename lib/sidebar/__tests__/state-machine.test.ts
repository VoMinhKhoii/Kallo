import { describe, expect, it } from 'vitest';
import {
  acceptsSidebarEvent,
  PEEK_IN_DELAY_MS,
  PEEK_OUT_DELAY_MS,
  type SidebarEnv,
  type SidebarEvent,
  sidebarTransition,
} from '@/lib/sidebar/state-machine';
import type { SidebarState } from '@/lib/sidebar/types';

const ALL_STATES: SidebarState[] = ['closed', 'peeked', 'open'];

/** Hover mode, fine pointer, motion allowed — the peek-capable environment. */
const HOVER: SidebarEnv = {
  expandMode: 'hover',
  finePointer: true,
  reducedMotion: false,
};
const HOVER_REDUCED: SidebarEnv = { ...HOVER, reducedMotion: true };
const HOVER_COARSE: SidebarEnv = { ...HOVER, finePointer: false };
const CLICK: SidebarEnv = { ...HOVER, expandMode: 'click' };

describe('acceptsSidebarEvent — the pre-guard', () => {
  it('accepts pointerEnter only in hover mode with a fine pointer', () => {
    expect(acceptsSidebarEvent({ type: 'pointerEnter' }, HOVER)).toBe(true);
    expect(acceptsSidebarEvent({ type: 'pointerEnter' }, HOVER_COARSE)).toBe(
      false
    );
    expect(acceptsSidebarEvent({ type: 'pointerEnter' }, CLICK)).toBe(false);
  });

  it('accepts pointerLeave only in hover mode, whatever the pointer', () => {
    // Click mode must leave the FSM entirely alone: focus-peek owns the peek
    // lifecycle there, and a stray pointerLeave would collapse it.
    expect(acceptsSidebarEvent({ type: 'pointerLeave' }, HOVER)).toBe(true);
    expect(acceptsSidebarEvent({ type: 'pointerLeave' }, HOVER_COARSE)).toBe(
      true
    );
    expect(acceptsSidebarEvent({ type: 'pointerLeave' }, CLICK)).toBe(false);
  });

  it('accepts every non-pointer event in every environment', () => {
    const events: SidebarEvent[] = [
      { type: 'focusEnter' },
      { type: 'focusLeave' },
      { type: 'togglePin' },
      { type: 'setPinned', collapsed: true },
      { type: 'setPinned', collapsed: false },
      { type: 'setExpandMode', mode: 'click' },
      { type: 'setExpandMode', mode: 'hover' },
    ];
    for (const env of [HOVER, HOVER_REDUCED, HOVER_COARSE, CLICK]) {
      for (const event of events) {
        expect(acceptsSidebarEvent(event, env)).toBe(true);
      }
    }
  });
});

describe('sidebarTransition — pointer peek-in', () => {
  it('defers closed → peeked when motion is allowed', () => {
    expect(
      sidebarTransition('closed', { type: 'pointerEnter' }, HOVER)
    ).toEqual({
      next: 'closed',
      persist: false,
      defer: {
        from: 'closed',
        to: 'peeked',
        delayMs: PEEK_IN_DELAY_MS,
      },
    });
  });

  it('peeks immediately when the user opted out of motion', () => {
    expect(
      sidebarTransition('closed', { type: 'pointerEnter' }, HOVER_REDUCED)
    ).toEqual({ next: 'peeked', persist: false, defer: null });
  });

  it('is inert from peeked and open', () => {
    for (const state of ['peeked', 'open'] as const) {
      expect(sidebarTransition(state, { type: 'pointerEnter' }, HOVER)).toEqual(
        {
          next: state,
          persist: false,
          defer: null,
        }
      );
    }
  });
});

describe('sidebarTransition — peek-out (pointerLeave and focusLeave)', () => {
  const leaves: SidebarEvent[] = [
    { type: 'pointerLeave' },
    { type: 'focusLeave' },
  ];

  it('defers peeked → closed when motion is allowed', () => {
    for (const event of leaves) {
      expect(sidebarTransition('peeked', event, HOVER)).toEqual({
        next: 'peeked',
        persist: false,
        defer: {
          from: 'peeked',
          to: 'closed',
          delayMs: PEEK_OUT_DELAY_MS,
        },
      });
    }
  });

  it('collapses immediately when the user opted out of motion', () => {
    for (const event of leaves) {
      expect(sidebarTransition('peeked', event, HOVER_REDUCED)).toEqual({
        next: 'closed',
        persist: false,
        defer: null,
      });
    }
  });

  it('is inert from closed and open — a peek-out never unpins', () => {
    for (const event of leaves) {
      for (const state of ['closed', 'open'] as const) {
        expect(sidebarTransition(state, event, HOVER)).toEqual({
          next: state,
          persist: false,
          defer: null,
        });
      }
    }
  });
});

describe('sidebarTransition — focus peek-in', () => {
  it('reveals labels for a keyboard user landing on a closed rail', () => {
    expect(sidebarTransition('closed', { type: 'focusEnter' }, CLICK)).toEqual({
      next: 'peeked',
      persist: false,
      defer: null,
    });
  });

  it('is mode-agnostic — hover mode peeks on focus too', () => {
    expect(sidebarTransition('closed', { type: 'focusEnter' }, HOVER)).toEqual({
      next: 'peeked',
      persist: false,
      defer: null,
    });
  });

  it('leaves peeked and open untouched', () => {
    for (const state of ['peeked', 'open'] as const) {
      expect(sidebarTransition(state, { type: 'focusEnter' }, CLICK)).toEqual({
        next: state,
        persist: false,
        defer: null,
      });
    }
  });
});

describe('sidebarTransition — pinning', () => {
  it('togglePin sends closed and peeked to open, and open to closed', () => {
    expect(sidebarTransition('closed', { type: 'togglePin' }, HOVER)).toEqual({
      next: 'open',
      persist: true,
      defer: null,
    });
    expect(sidebarTransition('peeked', { type: 'togglePin' }, HOVER)).toEqual({
      next: 'open',
      persist: true,
      defer: null,
    });
    expect(sidebarTransition('open', { type: 'togglePin' }, HOVER)).toEqual({
      next: 'closed',
      persist: true,
      defer: null,
    });
  });

  it('setPinned ignores the current state entirely', () => {
    for (const state of ALL_STATES) {
      expect(
        sidebarTransition(state, { type: 'setPinned', collapsed: true }, HOVER)
      ).toEqual({ next: 'closed', persist: true, defer: null });
      expect(
        sidebarTransition(state, { type: 'setPinned', collapsed: false }, HOVER)
      ).toEqual({ next: 'open', persist: true, defer: null });
    }
  });
});

describe('sidebarTransition — switching expand mode', () => {
  it('switching to click locks a live peek open', () => {
    expect(
      sidebarTransition(
        'peeked',
        { type: 'setExpandMode', mode: 'click' },
        HOVER
      )
    ).toEqual({ next: 'open', persist: true, defer: null });
  });

  it('switching to click keeps a resting state as it was', () => {
    for (const state of ['closed', 'open'] as const) {
      expect(
        sidebarTransition(
          state,
          { type: 'setExpandMode', mode: 'click' },
          HOVER
        )
      ).toEqual({ next: state, persist: true, defer: null });
    }
  });

  it('switching to hover always returns to the resting closed state', () => {
    for (const state of ALL_STATES) {
      expect(
        sidebarTransition(
          state,
          { type: 'setExpandMode', mode: 'hover' },
          CLICK
        )
      ).toEqual({ next: 'closed', persist: true, defer: null });
    }
  });

  it('reads the mode off the event, not off the environment', () => {
    // The hook dispatches this event before its own expandMode state has
    // re-rendered, so `env.expandMode` is still the outgoing mode.
    expect(
      sidebarTransition(
        'peeked',
        { type: 'setExpandMode', mode: 'click' },
        HOVER
      ).next
    ).toBe('open');
    expect(
      sidebarTransition('open', { type: 'setExpandMode', mode: 'hover' }, CLICK)
        .next
    ).toBe('closed');
  });
});

describe('sidebarTransition — invariants', () => {
  const events: SidebarEvent[] = [
    { type: 'pointerEnter' },
    { type: 'pointerLeave' },
    { type: 'focusEnter' },
    { type: 'focusLeave' },
    { type: 'togglePin' },
    { type: 'setPinned', collapsed: true },
    { type: 'setPinned', collapsed: false },
    { type: 'setExpandMode', mode: 'click' },
    { type: 'setExpandMode', mode: 'hover' },
  ];
  const envs = [HOVER, HOVER_REDUCED, HOVER_COARSE, CLICK];

  it('never persists an ephemeral peek', () => {
    for (const env of envs) {
      for (const state of ALL_STATES) {
        for (const event of events) {
          const { next, persist } = sidebarTransition(state, event, env);
          if (next === 'peeked') expect(persist).toBe(false);
        }
      }
    }
  });

  it('only ever defers a peek transition, never a pinned one', () => {
    for (const env of envs) {
      for (const state of ALL_STATES) {
        for (const event of events) {
          const { defer } = sidebarTransition(state, event, env);
          if (!defer) continue;
          expect([
            { from: 'closed', to: 'peeked', delayMs: PEEK_IN_DELAY_MS },
            { from: 'peeked', to: 'closed', delayMs: PEEK_OUT_DELAY_MS },
          ]).toContainEqual(defer);
        }
      }
    }
  });

  it('is pure — the same inputs always give the same result', () => {
    for (const env of envs) {
      for (const state of ALL_STATES) {
        for (const event of events) {
          expect(sidebarTransition(state, event, env)).toEqual(
            sidebarTransition(state, event, env)
          );
        }
      }
    }
  });
});
