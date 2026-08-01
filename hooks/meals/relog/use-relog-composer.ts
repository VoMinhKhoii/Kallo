'use client';

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import { useRelogCandidates } from '@/hooks/meals/relog/use-relog-candidates';
import { useRelogSubmit } from '@/hooks/meals/relog/use-relog-submit';
import { useSlashPicker } from '@/hooks/meals/relog/use-slash-picker';
import { useStagedEntries } from '@/hooks/meals/relog/use-staged-entries';
import type { MentionSegment } from '@/lib/logging/relog/mentions';
import type {
  RelogCandidate,
  RelogRef,
  SlashToken,
} from '@/lib/logging/relog/relog';
import type { ChatMessage } from '@/lib/types/meal';

const NO_SEGMENTS: MentionSegment[] = [];

/**
 * Composes the relog slice for the feed controller: the `/` picker, its
 * candidate search, the picked dishes (which live as tinted text inside the
 * composer), and the unified normal-mode submit.
 *
 * Relog is NORMAL-MODE ONLY — manual and cheat own the composer's slots
 * themselves, and mixing a third payload into them would make submit
 * ambiguous. The mention draft survives a mode switch and reappears on return,
 * so nothing the user picked is lost by toggling modes.
 */
export function useRelogComposer(args: {
  selectedDate: string;
  loggingMode: InputMode;
  inputRef: RefObject<MealInputHandle | null>;
  scrollToBottom: () => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** The AI submit (useFeedSubmit). Relog delegates text-only submits to it and
   *  routes the combined case through it with `refs`. Resolves to whether the
   *  analysis started. */
  handleSubmit: (override?: {
    message: string;
    refs?: RelogRef[];
  }) => Promise<boolean>;
}) {
  const {
    selectedDate,
    loggingMode,
    inputRef,
    scrollToBottom,
    setMessages,
    handleSubmit,
  } = args;
  const enabled = loggingMode === 'normal';

  const staged = useStagedEntries();

  const getTextarea = useCallback(
    () => inputRef.current?.getTextarea() ?? null,
    [inputRef]
  );
  const setText = useCallback(
    (text: string, caret?: number) => inputRef.current?.setText(text, caret),
    [inputRef]
  );

  // A pick rewrites the composer text; the picker writes the result back
  // through setText, so draft persistence and auto-resize stay in one place.
  const onSelect = useCallback(
    (candidate: RelogCandidate, value: string, token: SlashToken) =>
      staged.add(candidate, value, token),
    [staged]
  );

  // The picker produces the query; the query produces the options; the options
  // feed back into the picker's keyboard handling. That cycle is closed by
  // publishing the options into the picker's ref during render — one state
  // machine, no effect, no second instance to drift out of sync.
  const picker = useSlashPicker({ getTextarea, setText, onSelect, enabled });
  const candidates = useRelogCandidates(picker.query, picker.isOpen);
  picker.setOptions(candidates.options);

  // One handler for every "the text may have changed" signal: re-locate the
  // mentions first, then let the picker re-read the `/` token.
  const { syncFromTextarea: syncPicker } = picker;
  const { sync: syncMentions } = staged;
  const syncFromTextarea = useCallback(() => {
    const el = getTextarea();
    if (el) syncMentions(el.value);
    syncPicker();
  }, [getTextarea, syncMentions, syncPicker]);

  const removeStaged = useCallback(
    (stageId: string) => {
      const el = getTextarea();
      const next = staged.remove(stageId, el?.value ?? '');
      setText(next, next.length);
    },
    [getTextarea, setText, staged]
  );

  const handleNormalSubmit = useRelogSubmit({
    staged,
    selectedDate,
    scrollToBottom,
    getText: () => getTextarea()?.value ?? '',
    setText,
    setMessages,
    handleSubmit,
    enabled,
  });

  return {
    relogPicker: { ...picker, syncFromTextarea },
    relogCandidates: candidates,
    relogStaged: { ...staged, remove: removeStaged },
    /** The unified normal-mode submit: text-only → AI, picks-only → staged relog
     *  card, text+picks → AI with the picks merged server-side. */
    handleNormalSubmit,
    /** Coloured runs for the composer's mirror. Empty outside normal mode, so
     *  the textarea keeps its ordinary ink there. */
    mentionSegments: enabled ? staged.segments : NO_SEGMENTS,
    /** Whether the composer should show the relog surfaces at all. Callers must
     *  gate the staged list on this: MealInput renders its `aboveSlot` in every
     *  non-manual mode, so an ungated list would appear over the CHEAT
     *  composer. */
    isRelogEnabled: enabled,
    /** Gated on the mode too, not just the count — this arms submit, and in
     *  cheat mode a leftover draft would otherwise hijack it and relog dishes
     *  instead of running the cheat estimate. The draft itself is only hidden,
     *  never cleared, so switching back restores it. */
    hasStagedRelog: enabled && staged.entries.length > 0,
  };
}
