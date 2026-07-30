'use client';

import { type RefObject, useCallback } from 'react';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import type { MealInputHandle } from '@/components/logging/input/meal-input';
import { useRelogCandidates } from '@/hooks/meals/relog/use-relog-candidates';
import { useRelogMeal } from '@/hooks/meals/relog/use-relog-meal';
import { useRelogSubmit } from '@/hooks/meals/relog/use-relog-submit';
import { useSlashPicker } from '@/hooks/meals/relog/use-slash-picker';
import { useStagedEntries } from '@/hooks/meals/relog/use-staged-entries';
import type { RelogCandidate } from '@/lib/logging/relog/relog';

/**
 * Composes the relog slice for the feed controller: the `/` picker, its
 * candidate search, the staged list, and the submit path.
 *
 * Relog is NORMAL-MODE ONLY — manual and cheat have their own composer
 * controls, and mixing a third payload into them would make submit ambiguous.
 * The staged draft survives a mode switch and reappears on return, so nothing
 * the user picked is lost by toggling modes.
 */
export function useRelogComposer(args: {
  userId: string;
  selectedDate: string;
  loggingMode: InputMode;
  inputRef: RefObject<MealInputHandle | null>;
  scrollToBottom: () => void;
}) {
  const { userId, selectedDate, loggingMode, inputRef, scrollToBottom } = args;
  const enabled = loggingMode === 'normal';

  const staged = useStagedEntries();
  const relogMeal = useRelogMeal(userId);

  const getTextarea = useCallback(
    () => inputRef.current?.getTextarea() ?? null,
    [inputRef]
  );
  const setText = useCallback(
    (text: string, caret?: number) => inputRef.current?.setText(text, caret),
    [inputRef]
  );
  const onSelect = useCallback(
    (candidate: RelogCandidate) => staged.add(candidate),
    [staged]
  );

  // The picker produces the query; the query produces the options; the options
  // feed back into the picker's keyboard handling. That cycle is closed by
  // publishing the options into the picker's ref during render — one state
  // machine, no effect, no second instance to drift out of sync.
  const picker = useSlashPicker({ getTextarea, setText, onSelect, enabled });
  const candidates = useRelogCandidates(picker.query, picker.isOpen);
  picker.setOptions(candidates.options);

  const handleRelogSubmit = useRelogSubmit({
    staged,
    relogMeal,
    selectedDate,
    scrollToBottom,
  });

  return {
    relogPicker: picker,
    relogCandidates: candidates,
    relogStaged: staged,
    relogMeal,
    handleRelogSubmit,
    /** Whether the composer should show the relog surfaces at all. Callers must
     *  gate the staged list on this: MealInput renders its `aboveSlot` in every
     *  non-manual mode, so an ungated list would appear over the CHEAT
     *  composer. */
    isRelogEnabled: enabled,
    /** Gated on the mode too, not just the count — this arms submit, and in
     *  cheat mode a leftover staged draft would otherwise hijack it and relog
     *  dishes instead of running the cheat estimate. The draft itself is only
     *  hidden, never cleared, so switching back restores it. */
    hasStagedRelog: enabled && staged.entries.length > 0,
  };
}
