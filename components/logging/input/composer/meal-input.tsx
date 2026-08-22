'use client';

import { Barcode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useState } from 'react';
import { BarcodeScannerDialog } from '@/components/logging/input/barcode/barcode-scanner-dialog';
import { CheatModePicker } from '@/components/logging/input/composer/cheat-mode-picker';
import { ComposerSendButton } from '@/components/logging/input/composer/composer-send-button';
import { ComposerTextField } from '@/components/logging/input/composer/composer-text-field';
import { useMealInputState } from '@/components/logging/input/composer/use-meal-input-state';
import { ManualLoggingControls } from '@/components/logging/input/manual/manual-logging-controls';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import { readDraft } from '@/lib/domain/logging/meal-input-draft';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';
import type { MentionSegment } from '@/lib/domain/logging/relog/mentions';
import type { InputMode } from '@/lib/domain/logging/types';

interface MealInputProps {
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
}

export const MealInput = forwardRef<MealInputHandle, MealInputProps>(
  function MealInput(
    {
      onSubmit,
      onCancel,
      disabled,
      mode = 'normal',
      onModeChange,
      cheatIntensity,
      onChangeIntensity,
      selectedDate,
      onBarcodeSuccess,
      aboveSlot,
      popupSlot,
      onTextareaKeyDown,
      onTextareaSync,
      hasExternalContent,
      popupListboxId,
      popupActiveDescendantId,
      isPopupOpen,
      mentionSegments,
    },
    ref
  ) {
    const t = useTranslations('logging');
    const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
    const isManual = mode === 'manual';
    const isCheat = mode === 'cheat';

    const {
      textareaRef,
      manualRows,
      canSubmit,
      handleChange,
      handleKeyDown,
      handleRowChange,
      handleRowAdd,
      handleRowRemove,
    } = useMealInputState(ref, {
      isManual,
      disabled,
      hasExternalContent,
      onSubmit,
      onTextareaSync,
      onTextareaKeyDown,
    });

    const placeholder = isCheat ? t('cheatPlaceholder') : t('placeholder');

    return (
      /* `relative` anchors popupSlot, which opens upward over the feed. */
      <div className="relative flex flex-col gap-2 rounded-2xl border border-kallo-border/40 bg-white p-3 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-kallo-accent)_6%,transparent)] transition-all duration-300 focus-within:border-kallo-accent/40 focus-within:shadow-[0_4px_20px_color-mix(in_srgb,var(--color-kallo-accent)_12%,transparent)]">
        {popupSlot}

        {/* Manual mode: DB-backed ingredient rows */}
        {isManual && (
          <ManualLoggingControls
            disabled={disabled}
            rows={manualRows}
            onRowChange={handleRowChange}
            onRowAdd={handleRowAdd}
            onRowRemove={handleRowRemove}
          />
        )}

        {!isManual && aboveSlot}

        <div className="flex items-center gap-2">
          {!isManual && (
            <>
              <label htmlFor="meal-input" className="sr-only">
                {placeholder}
              </label>
              <ComposerTextField
                textareaRef={textareaRef}
                defaultValue={readDraft()}
                placeholder={placeholder}
                disabled={disabled}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onSync={onTextareaSync}
                mentionSegments={mentionSegments}
                isPopupOpen={isPopupOpen}
                popupListboxId={popupListboxId}
                popupActiveDescendantId={popupActiveDescendantId}
              />
              {selectedDate && onBarcodeSuccess && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setIsBarcodeOpen(true)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-kallo-border/40 text-kallo-text-muted transition-all duration-200 hover:bg-kallo-hover hover:text-kallo-text active:scale-95 disabled:opacity-30"
                  aria-label={t('barcodeScan')}
                >
                  <Barcode className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          {isManual && <div className="flex-1" />}

          {onModeChange && (
            <CheatModePicker
              mode={mode}
              intensity={cheatIntensity ?? 'medium'}
              disabled={disabled}
              onChangeMode={onModeChange}
              onChangeIntensity={(next) => onChangeIntensity?.(next)}
            />
          )}
          <ComposerSendButton
            showStop={Boolean(disabled && onCancel)}
            canSubmit={canSubmit}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </div>
        {selectedDate && onBarcodeSuccess && (
          <BarcodeScannerDialog
            isOpen={isBarcodeOpen}
            onOpenChange={setIsBarcodeOpen}
            selectedDate={selectedDate}
            onSuccess={onBarcodeSuccess}
          />
        )}
      </div>
    );
  }
);
