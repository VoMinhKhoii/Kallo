'use client';

import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { StagedEntriesApi } from '@/hooks/meals/relog/use-staged-entries';
import { stageRelogAnalysisAction } from '@/lib/actions/meals/relog/stage-relog-analysis';
import type { ChatMessage } from '@/lib/core/types/meal';
import { stripMentions } from '@/lib/domain/logging/relog/mentions';
import {
  buildRelogRawInput,
  type RelogRef,
} from '@/lib/domain/logging/relog/relog';

/** One key per staged SELECTION, order-independent. */
const selectionKey = (stageIds: readonly string[]) =>
  [...stageIds].sort().join('|');

/**
 * The unified normal-mode submit. One handler now covers all three shapes so a
 * single submit produces one review card (the user always edits before saving):
 *
 *  - text only, no picks        → the ordinary AI analysis (`handleSubmit`).
 *  - picks only, no free text   → stage a deterministic relog analysis and
 *                                 surface its review card (no AI, no spend).
 *  - free text AND picks        → analyze the text alone and pass the picks as
 *                                 `refs`; the server merges the copied dishes
 *                                 into the result, so relogged items are never
 *                                 re-analyzed.
 *
 * The picked dishes live as tinted mention runs inside the composer, so the
 * "free text" is whatever survives `stripMentions`.
 */
export function useRelogSubmit(args: {
  staged: StagedEntriesApi;
  selectedDate: string;
  scrollToBottom: () => void;
  getText: () => string;
  setText: (text: string, caret?: number) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** The AI submit (useFeedSubmit). `override` routes stripped text + picks
   *  through the same streaming path for the combined case. Resolves to whether
   *  the analysis actually started, so picks are cleared only on a real submit. */
  handleSubmit: (override?: {
    message: string;
    refs?: RelogRef[];
    /** What the card should SAY, when that differs from the analyzed text. */
    label?: string;
  }) => Promise<boolean>;
  /** Relog is normal-mode only. Checked HERE as well as at the call site:
   *  entries survive a mode switch (only their UI is hidden), so a caller that
   *  forgot the gate would otherwise relog dishes out of cheat mode. */
  enabled: boolean;
}) {
  const {
    staged,
    selectedDate,
    scrollToBottom,
    getText,
    setText,
    setMessages,
    handleSubmit,
    enabled,
  } = args;
  const t = useTranslations('logging.feedArea');
  // Pure-relog staging is a quick DB insert (no AI); guard against a double-fire.
  const [isStagingRelog, setIsStagingRelog] = useState(false);

  // Attempt ids for pure-relog submits, keyed by the selection they staged.
  //
  // Retrying the same picks must reuse its id so the server's
  // `(user_id, attempt_id)` upsert overwrites the row it already wrote. Without
  // that, a stage that commits but loses its response — the composer is left
  // untouched, so the user resubmits — writes a SECOND pending row, and one
  // meal arrives as two cards to confirm. A ref, not state: nothing renders
  // from it, and it must not be stale inside an in-flight handler.
  const attemptIds = useRef(new Map<string, string>());
  // Stable identities: the ref never changes, so these have no dependencies and
  // do not re-arm the submit callback on every render.
  const attemptIdFor = useCallback((stageIds: readonly string[]) => {
    const key = selectionKey(stageIds);
    const existing = attemptIds.current.get(key);
    if (existing) return existing;
    const minted = crypto.randomUUID();
    attemptIds.current.set(key, minted);
    return minted;
  }, []);
  const releaseAttemptId = useCallback((stageIds: readonly string[]) => {
    attemptIds.current.delete(selectionKey(stageIds));
  }, []);

  const handleNormalSubmit = useCallback(async () => {
    // Cheat mode (and any non-normal mode) has no relog picks — the estimator
    // reads the composer directly. Delegating keeps ONE submit entry point for
    // the composer while relog stays normal-mode only.
    if (!enabled) {
      await handleSubmit();
      return;
    }

    // No picks staged → the ordinary AI path reads the composer itself.
    if (staged.entries.length === 0) {
      await handleSubmit();
      return;
    }

    const refs: RelogRef[] = staged.entries.map((entry) => entry.ref);
    // What the user typed AROUND the picks. Empty ⇒ a pure relog.
    const freeText = stripMentions(getText(), staged.entries);

    // Combined: analyze the free text alone, merge the picks server-side.
    //
    // `handleSubmit` clears the composer synchronously (to show the streaming
    // card) and only resolves once the stream settles, reporting whether it
    // DURABLY staged. So snapshot the composer first: on a durable success we
    // drop the staged picks (their card now exists); on ANY failure — invalid
    // text, error, or a precise-clarify that stages nothing — we restore the
    // composer verbatim and re-sync so the picks reappear intact for a retry,
    // instead of vanishing behind a submit that produced no confirmable card.
    //
    // The restore DOES cost something: the snapshot predates the submit, so
    // anything typed while the analysis was in flight is replaced by it. That
    // is a chosen trade, not an oversight. A reference cannot be retyped (the
    // picker has to be reopened and the dish found again), whereas a sentence
    // can, and the window is one failed analysis long. The Flutter composer
    // restores the same way, so the two platforms lose the same keystrokes.
    if (freeText.length > 0) {
      const snapshot = getText();
      // The card's label is derived the way the SERVER derives the persisted
      // one — same helper, same order — so the streaming card, the confirmable
      // card and the saved meal all read as the same meal.
      const durablyStaged = await handleSubmit({
        message: freeText,
        refs,
        label: buildRelogRawInput([
          freeText,
          ...staged.entries.map((entry) => entry.label),
        ]),
      });
      if (durablyStaged) {
        staged.consume('');
      } else {
        setText(snapshot, snapshot.length);
        staged.sync(snapshot);
      }
      return;
    }

    // Pure relog: stage a deterministic analysis and surface its review card,
    // mirroring handleRepeatCheat. Nothing is written until the user confirms.
    if (isStagingRelog) return;
    setIsStagingRelog(true);
    // Stable across retries of the SAME picks, so a stage that commits but
    // loses its response upserts the row it already wrote instead of adding a
    // second pending card for one meal. Changing the selection mints a new id.
    const stageIds = staged.entries.map((entry) => entry.stageId);
    const attemptId = attemptIdFor(stageIds);
    try {
      const result = await stageRelogAnalysisAction({
        items: refs,
        loggedDate: selectedDate,
        timezoneOffset: new Date().getTimezoneOffset(),
        attemptId,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          parsedMeal: result.parsedMeal,
          userInput: result.rawInput,
          timestamp: new Date(result.loggedAt),
          loggedDate: selectedDate,
          analysisId: result.analysisId,
          attemptId,
        },
      ]);
      // Only after staging lands, and only the mention text: anything the user
      // typed around the picks is theirs. On failure nothing is touched, so a
      // dead reference can be dropped and retried without losing every pick.
      const remaining = staged.consume(getText(), stageIds);
      releaseAttemptId(stageIds);
      setText(remaining, remaining.length);
      scrollToBottom();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('saveError'));
    } finally {
      setIsStagingRelog(false);
    }
  }, [
    enabled,
    staged,
    selectedDate,
    scrollToBottom,
    getText,
    setText,
    setMessages,
    handleSubmit,
    isStagingRelog,
    attemptIdFor,
    releaseAttemptId,
    t,
  ]);

  return handleNormalSubmit;
}
