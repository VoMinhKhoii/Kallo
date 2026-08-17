'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { RefObject } from 'react';
import { CheatOccasionChips } from '@/components/logging/feed/cheat/cheat-occasion-chips';
import { ComposerGlow } from '@/components/logging/feed/composer/composer-glow';
import { MealInput } from '@/components/logging/input/composer/meal-input';
import { RelogPickerPopup } from '@/components/logging/input/relog/relog-picker-popup';
import { StagedList } from '@/components/logging/input/relog/staged-list';
import type { useRelogComposer } from '@/hooks/meals/relog/use-relog-composer';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import {
  EMPTY_ENTRANCE,
  ENTRANCE_EASE,
} from '@/lib/domain/logging/empty-entrance';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';
import type { InputMode } from '@/lib/domain/logging/types';

const RELOG_LISTBOX_ID = 'relog-picker-listbox';

interface FeedComposerProps {
  relog: ReturnType<typeof useRelogComposer>;
  inputRef: RefObject<MealInputHandle | null>;
  isCheat: boolean;
  cheatOccasions: RecentCheatOccasion[];
  cheatOccasionsDisabled: boolean;
  onSelectCheatOccasion: (occasion: RecentCheatOccasion) => void;
  onSubmit: () => void;
  onCancel: () => void;
  disabled: boolean;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  cheatIntensity: CheatIntensity;
  onChangeIntensity: (intensity: CheatIntensity) => void;
  selectedDate: string;
  onBarcodeSuccess: () => void;
  /**
   * Whether a change of position should be sprung. False until the day query
   * has answered once — see `animateComposerLayout`.
   */
  animateLayout: boolean;
}

/**
 * The composer strip — `layout` smoothly tweens it from the centered position
 * (empty day) down to the bottom once cards take the height above it.
 */
export function FeedComposer({
  relog,
  inputRef,
  isCheat,
  cheatOccasions,
  cheatOccasionsDisabled,
  onSelectCheatOccasion,
  onSubmit,
  onCancel,
  disabled,
  mode,
  onModeChange,
  cheatIntensity,
  onChangeIntensity,
  selectedDate,
  onBarcodeSuccess,
  animateLayout,
}: FeedComposerProps) {
  const {
    relogPicker,
    relogCandidates,
    relogStaged,
    hasStagedRelog,
    isRelogEnabled,
  } = relog;
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      layout={animateLayout}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="relative shrink-0 px-3 pt-2 pb-3 sm:px-6 sm:pb-4"
    >
      <ComposerGlow />
      {isCheat && (
        <CheatOccasionChips
          occasions={cheatOccasions}
          disabled={cheatOccasionsDisabled}
          onSelect={onSelectCheatOccasion}
        />
      )}
      {/* The first beat: the input is what you came for, so it arrives before
          the light behind it and the question above it. A fade, NOT a rise —
          the bar has to be where it belongs from the first frame, and anything
          that moves it reads as the page still settling. */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.45,
          delay: EMPTY_ENTRANCE.input,
          ease: ENTRANCE_EASE,
        }}
        className="relative z-10 mx-auto w-full max-w-3xl"
      >
        <MealInput
          ref={inputRef}
          onSubmit={onSubmit}
          onCancel={onCancel}
          disabled={disabled}
          mode={mode}
          onModeChange={onModeChange}
          cheatIntensity={cheatIntensity}
          onChangeIntensity={onChangeIntensity}
          selectedDate={selectedDate}
          onBarcodeSuccess={onBarcodeSuccess}
          hasExternalContent={hasStagedRelog}
          onTextareaKeyDown={relogPicker.handleKeyDown}
          onTextareaSync={relogPicker.syncFromTextarea}
          isPopupOpen={relogPicker.isOpen}
          mentionSegments={relog.mentionSegments}
          popupListboxId={RELOG_LISTBOX_ID}
          popupActiveDescendantId={`${RELOG_LISTBOX_ID}-${relogPicker.highlighted}`}
          aboveSlot={
            // MealInput renders aboveSlot in every non-manual mode, so this
            // gate is what keeps the staged list out of cheat mode.
            isRelogEnabled ? (
              <StagedList
                entries={relogStaged.entries}
                totals={relogStaged.totals}
                disabled={disabled}
                onRemove={relogStaged.remove}
              />
            ) : null
          }
          popupSlot={
            relogPicker.isOpen ? (
              <RelogPickerPopup
                listboxId={RELOG_LISTBOX_ID}
                query={relogPicker.query}
                candidates={relogCandidates}
                highlighted={relogPicker.highlighted}
                onHighlight={relogPicker.setHighlighted}
                onSelect={relogPicker.select}
              />
            ) : null
          }
        />
      </motion.div>
    </motion.div>
  );
}
