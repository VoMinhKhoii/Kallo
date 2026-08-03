'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStagedDraft, writeStagedDraft } from '@/lib/logging/relog/draft';
import {
  buildMentionSegments,
  insertMention,
  type MentionSegment,
  type RelogMention,
  reconcileMentions,
  stripMentions,
} from '@/lib/logging/relog/mentions';
import {
  RELOG_MAX_STAGED,
  type RelogCandidate,
  type SlashToken,
  sumStagedMacros,
  toStagedEntry,
} from '@/lib/logging/relog/relog';

const DRAFT_DEBOUNCE_MS = 500;

export interface StagedEntriesApi {
  entries: RelogMention[];
  totals: ReturnType<typeof sumStagedMacros>;
  segments: MentionSegment[];
  /** Insert a pick into the composer text and stage its reference. Returns the
   *  new value + caret for the caller to write back through `setText`. */
  add: (
    candidate: RelogCandidate,
    value: string,
    token: SlashToken
  ) => { value: string; caret: number } | null;
  /** Drop a pick and remove its text. Returns the new composer value. */
  remove: (stageId: string, value: string) => string;
  /** Re-locate mentions after the user edited the text. */
  sync: (value: string) => void;
  /** Clear staged picks and return the value with their text removed. */
  consume: (value: string) => string;
  isFull: boolean;
}

/**
 * The picked dishes, which live as tinted text inside the composer itself.
 *
 * The textarea's value is the single source of truth for what the user sees;
 * this hook holds the parallel list of references plus each one's offset into
 * that value. `sync` re-derives the offsets on every keystroke and drops any
 * mention whose text the user broke — that is what stops a half-deleted dish
 * name from still logging a dish.
 *
 * Entries are keyed by a client-minted `stageId`, never by the reference:
 * picking the same coffee twice is a real meal. Everything stored here except
 * the reference is display-only — the server re-resolves nutrition from
 * `(sourceMealId, mealItemOrder)` — so a stale draft can show a stale macro
 * line but can never corrupt a save.
 */
export function useStagedEntries(): StagedEntriesApi {
  const [entries, setEntries] = useState<RelogMention[]>(() =>
    readStagedDraft().map((entry, index) => ({ ...entry, start: index }))
  );
  // The composer text as of the last sync, so segments can be rebuilt without
  // reaching back into the DOM during render.
  const [value, setValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(
      () => writeStagedDraft(entries),
      DRAFT_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [entries]);

  // Flush on tab close; the debounce above would otherwise lose the last pick.
  useEffect(() => {
    const flush = () => writeStagedDraft(entries);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [entries]);

  const sync = useCallback((next: string) => {
    setValue(next);
    setEntries((prev) => {
      const reconciled = reconcileMentions(next, prev);
      // Keep the identity stable when nothing moved, so the overlay and the
      // draft effect don't churn on every keystroke.
      const unchanged =
        reconciled.length === prev.length &&
        reconciled.every((m, i) => m.start === prev[i].start);
      return unchanged ? prev : reconciled;
    });
  }, []);

  // add/remove/consume run from event handlers, never from render, so they read
  // `entries` directly. Computing the next text OUTSIDE the state updaters
  // keeps those updaters pure — a side effect inside one would fire twice under
  // StrictMode and desync the text from the offsets.
  const add = useCallback(
    (candidate: RelogCandidate, current: string, token: SlashToken) => {
      if (entries.length >= RELOG_MAX_STAGED) return null;
      const inserted = insertMention(current, token, candidate.name);
      const entry = toStagedEntry(candidate, crypto.randomUUID());
      // Re-derive every offset from the new text rather than trusting the
      // insertion point alone — mentions after it all shifted right.
      //
      // FIRST in the list, not last. `reconcileMentions` sorts by offset, and
      // the new pick ties with any existing mention that started exactly where
      // this one was spliced in — the tie has to break in favour of the
      // newcomer, because the splice is what pushed the other one right.
      setEntries(
        reconcileMentions(inserted.value, [
          { ...entry, start: inserted.start },
          ...entries,
        ])
      );
      setValue(inserted.value);
      return { value: inserted.value, caret: inserted.caret };
    },
    [entries]
  );

  const remove = useCallback(
    (stageId: string, current: string) => {
      const target = entries.find((entry) => entry.stageId === stageId);
      if (!target) return current;
      const next = stripMentions(current, [target]);
      setEntries(
        reconcileMentions(
          next,
          entries.filter((entry) => entry.stageId !== stageId)
        )
      );
      setValue(next);
      return next;
    },
    [entries]
  );

  const consume = useCallback(
    (current: string) => {
      const next = stripMentions(current, entries);
      setEntries([]);
      setValue(next);
      writeStagedDraft([]);
      return next;
    },
    [entries]
  );

  const totals = useMemo(() => sumStagedMacros(entries), [entries]);
  const segments = useMemo(
    () => (entries.length > 0 ? buildMentionSegments(value, entries) : []),
    [value, entries]
  );

  return {
    entries,
    totals,
    segments,
    add,
    remove,
    sync,
    consume,
    isFull: entries.length >= RELOG_MAX_STAGED,
  };
}
