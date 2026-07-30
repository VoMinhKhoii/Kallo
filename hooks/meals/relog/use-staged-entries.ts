'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { readStagedDraft, writeStagedDraft } from '@/lib/logging/relog/draft';
import {
  RELOG_MAX_STAGED,
  type RelogCandidate,
  type RelogStagedEntry,
  sumStagedMacros,
  toStagedEntry,
} from '@/lib/logging/relog/relog';

const DRAFT_DEBOUNCE_MS = 500;

export interface StagedEntriesApi {
  entries: RelogStagedEntry[];
  totals: ReturnType<typeof sumStagedMacros>;
  add: (candidate: RelogCandidate) => void;
  remove: (stageId: string) => void;
  clear: () => void;
  isFull: boolean;
}

/**
 * The dishes/meals staged above the composer, with draft persistence matching
 * how manual rows already behave.
 *
 * Entries are keyed by a client-minted `stageId`, never by the reference:
 * picking the same coffee twice is a real meal, and keying on the ref would
 * make "remove" delete the wrong row. Everything stored here except the
 * reference is display-only — the server re-resolves nutrition from
 * `(sourceMealId, mealItemOrder)` — so a stale draft can show a stale subtitle
 * but can never corrupt a save.
 */
export function useStagedEntries(): StagedEntriesApi {
  const [entries, setEntries] = useState<RelogStagedEntry[]>(() =>
    readStagedDraft()
  );

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

  const add = useCallback((candidate: RelogCandidate) => {
    setEntries((prev) =>
      prev.length >= RELOG_MAX_STAGED
        ? prev
        : [...prev, toStagedEntry(candidate, crypto.randomUUID())]
    );
  }, []);

  const remove = useCallback((stageId: string) => {
    setEntries((prev) => prev.filter((entry) => entry.stageId !== stageId));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    writeStagedDraft([]);
  }, []);

  const totals = useMemo(() => sumStagedMacros(entries), [entries]);

  return {
    entries,
    totals,
    add,
    remove,
    clear,
    isFull: entries.length >= RELOG_MAX_STAGED,
  };
}
