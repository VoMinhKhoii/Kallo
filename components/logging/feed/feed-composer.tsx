'use client';

import { motion } from 'motion/react';
import type { RefObject } from 'react';
import { CheatOccasionChips } from '@/components/logging/feed/cheat/cheat-occasion-chips';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import {
  MealInput,
  type MealInputHandle,
} from '@/components/logging/input/meal-input';
import type { RecentCheatOccasion } from '@/lib/actions/meals/types';
import type { CheatIntensity } from '@/lib/types/cheat';

interface FeedComposerProps {
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
}

/**
 * The composer strip — `layout` smoothly tweens it from the centered position
 * (empty day) down to the bottom once cards take the height above it.
 */
export function FeedComposer({
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
}: FeedComposerProps) {
  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="shrink-0 px-3 pt-2 pb-3 sm:px-6 sm:pb-4"
    >
      {isCheat && (
        <CheatOccasionChips
          occasions={cheatOccasions}
          disabled={cheatOccasionsDisabled}
          onSelect={onSelectCheatOccasion}
        />
      )}
      <div className="mx-auto w-full max-w-3xl">
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
        />
      </div>
    </motion.div>
  );
}
