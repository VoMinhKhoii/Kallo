'use client';

import { useTranslations } from 'next-intl';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { StagedEntriesApi } from '@/hooks/meals/relog/use-staged-entries';
import { stageRelogAnalysisAction } from '@/lib/actions/meals/relog/stage-relog-analysis';
import { stripMentions } from '@/lib/logging/relog/mentions';
import type { RelogRef } from '@/lib/logging/relog/relog';
import type { ChatMessage } from '@/lib/types/meal';

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
    if (freeText.length > 0) {
      const snapshot = getText();
      const durablyStaged = await handleSubmit({ message: freeText, refs });
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
    // Stable per-attempt id so a re-stage of this card upserts its pending row.
    const attemptId = crypto.randomUUID();
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
      const remaining = staged.consume(getText());
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
    t,
  ]);

  return handleNormalSubmit;
}
