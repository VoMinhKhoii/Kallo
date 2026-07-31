'use client';

import { useCallback, useRef, useState } from 'react';
import {
  parseSlashToken,
  type RelogCandidate,
  type SlashToken,
} from '@/lib/logging/relog/relog';

export interface SlashPickerApi {
  isOpen: boolean;
  query: string;
  highlighted: number;
  setHighlighted: (index: number) => void;
  /** Publish the currently-rendered options. Called during render by the owner,
   *  because the options depend on `query` — which this hook produces. Writing
   *  a ref (plus a guarded highlight re-anchor) is how the cycle is broken
   *  without a second state machine or an effect. */
  setOptions: (options: RelogCandidate[]) => void;
  /** Call on every textarea `input`, `keyup` and `click`. */
  syncFromTextarea: () => void;
  /** Call FIRST from the textarea's keydown, after its IME guard. Returns true
   *  (having already called preventDefault) when the picker consumed the key,
   *  so the composer's own Enter-to-submit stays untouched while closed. */
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  select: (candidate: RelogCandidate) => void;
  close: () => void;
}

interface Options {
  getTextarea: () => HTMLTextAreaElement | null;
  /** Replace the composer text and place the caret — the component's existing
   *  imperative setter, so draft persistence and auto-resize stay in one place. */
  setText: (text: string, caret?: number) => void;
  /** Commit a pick. Receives the current composer text and the token being
   *  replaced; returns the text to write back (or null if the pick was
   *  refused, e.g. the staged cap). */
  onSelect: (
    candidate: RelogCandidate,
    value: string,
    token: SlashToken
  ) => { value: string; caret: number } | null;
  /** Relog is normal-mode only; manual/cheat have their own controls. */
  enabled: boolean;
}

const EMPTY_OPTIONS: RelogCandidate[] = [];

/**
 * The `/` mention-picker state machine over the composer's UNCONTROLLED
 * textarea.
 *
 * The textarea stays uncontrolled on purpose — its draft persistence,
 * auto-resize and IME behaviour all depend on that — so this hook only ever
 * READS `value` + `selectionStart` and writes back through the component's
 * existing `setText`. Nothing here makes React the owner of the text.
 */
export function useSlashPicker({
  getTextarea,
  setText,
  onSelect,
  enabled,
}: Options): SlashPickerApi {
  const [token, setToken] = useState<SlashToken | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  // Esc must not re-open on the next keystroke, but a NEW `/` must. Remember
  // which slash was dismissed rather than suppressing the picker globally.
  const dismissedAt = useRef<number | null>(null);
  const optionsRef = useRef<RelogCandidate[]>(EMPTY_OPTIONS);

  const isOpen = enabled && token !== null;

  const setOptions = useCallback(
    (options: RelogCandidate[]) => {
      if (optionsRef.current === options) return;
      optionsRef.current = options;
      // Re-anchor during render rather than in an effect, which would paint a
      // highlight pointing at a row that no longer exists for one frame.
      if (highlighted >= options.length) setHighlighted(0);
    },
    [highlighted]
  );

  const syncFromTextarea = useCallback(() => {
    if (!enabled) {
      setToken(null);
      return;
    }
    const el = getTextarea();
    if (!el) return;
    const next = parseSlashToken(el.value, el.selectionStart ?? 0);
    // A different `/` than the dismissed one means the user started a new
    // mention, so the dismissal no longer applies.
    if (next === null || next.start !== dismissedAt.current) {
      dismissedAt.current = null;
    } else {
      setToken(null);
      return;
    }
    setToken((current) => {
      if (current?.start === next?.start && current?.query === next?.query) {
        return current;
      }
      // Any change of query re-anchors the highlight to the top result.
      if (current?.query !== next?.query) setHighlighted(0);
      return next;
    });
  }, [enabled, getTextarea]);

  const close = useCallback(() => setToken(null), []);

  const select = useCallback(
    (candidate: RelogCandidate) => {
      const el = getTextarea();
      if (el && token) {
        // The owner replaces the `/token` with the picked label and hands back
        // the resulting text — the pick becomes visible, tinted prose in the
        // composer rather than disappearing into a list elsewhere.
        const next = onSelect(candidate, el.value, token);
        if (next) setText(next.value, next.caret);
      }
      setToken(null);
      dismissedAt.current = null;
      setHighlighted(0);
    },
    [getTextarea, onSelect, setText, token]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(isOpen && token)) return false;
      const options = optionsRef.current;

      if (event.key === 'Escape') {
        event.preventDefault();
        dismissedAt.current = token.start;
        setToken(null);
        return true;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (options.length === 0) return true;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        // Clamped, not wrapping — matches the ingredient combobox.
        setHighlighted((current) =>
          Math.min(Math.max(current + delta, 0), options.length - 1)
        );
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        // Swallow Enter even with no results: submitting the raw "/pho" text to
        // the AI pipeline is never what the user meant.
        event.preventDefault();
        const candidate = options[highlighted];
        if (candidate) select(candidate);
        return true;
      }
      return false;
    },
    [highlighted, isOpen, select, token]
  );

  return {
    isOpen,
    query: token?.query ?? '',
    highlighted,
    setHighlighted,
    setOptions,
    syncFromTextarea,
    handleKeyDown,
    select,
    close,
  };
}
