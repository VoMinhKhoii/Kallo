import type { ManualSave } from '@/hooks/meals/entry/use-manual-submit';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import type { MentionSegment } from '@/lib/domain/logging/relog/mentions';
import type { InputMode } from '@/lib/domain/logging/types';

/** The composer's props — the feed drives everything it shows. */
export interface MealInputProps {
  onSubmit: () => void;
  /** When provided and the condition (analysis in flight) is active, the
   * submit button is replaced with a stop button that calls this. */
  onCancel?: () => void;
  disabled?: boolean;
  /** Current input mode: normal | manual | cheat. Controlled from outside. */
  mode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  /** Indulgence magnitude shown in the mode picker (cheat mode). */
  cheatIntensity?: CheatIntensity;
  onChangeIntensity?: (next: CheatIntensity) => void;
  selectedDate?: string;
  onBarcodeSuccess?: () => void;
  /** Content rendered above the textarea, in the slot manual mode's rows use.
   *  Deliberately generic — the composer stays unaware of what fills it. */
  aboveSlot?: React.ReactNode;
  /** Overlay anchored to the composer card (the `/` picker). */
  popupSlot?: React.ReactNode;
  /** Gets first refusal on keydown, AFTER the IME guard. Returning true (having
   *  called preventDefault) means an overlay consumed the key, so the Enter
   *  submit below is skipped. */
  onTextareaKeyDown?: (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => boolean;
  /** Fired whenever the value or caret may have moved, so an overlay can
   *  re-read them. The textarea stays uncontrolled either way. */
  onTextareaSync?: () => void;
  /** Lets submit stay enabled when the composer text is empty but the
   *  `aboveSlot` holds something submittable. */
  hasExternalContent?: boolean;
  /** ARIA wiring for an overlay listbox; ignored when no popup is open. */
  popupListboxId?: string;
  popupActiveDescendantId?: string;
  isPopupOpen?: boolean;
  /** Coloured runs to paint behind the textarea. When non-empty the textarea's
   *  own glyphs go transparent and this mirror becomes what the user sees —
   *  the only way to tint part of a textarea's value. */
  mentionSegments?: MentionSegment[];
  /** Saves the phone sheets' plate. With it, manual mode on a phone opens the
   *  iOS app's stacked sheets instead of the composer's inline rows. */
  onManualSave?: ManualSave;
}
