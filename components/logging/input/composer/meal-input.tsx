'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, useState } from 'react';
import { CheatModePicker } from '@/components/logging/input/composer/cheat-mode-picker';
import { ComposerBarcode } from '@/components/logging/input/composer/composer-barcode';
import { ComposerSendButton } from '@/components/logging/input/composer/composer-send-button';
import { ComposerTextField } from '@/components/logging/input/composer/composer-text-field';
import type { MealInputProps } from '@/components/logging/input/composer/meal-input-props';
import { useMealInputState } from '@/components/logging/input/composer/use-meal-input-state';
import { ManualLoggingControls } from '@/components/logging/input/manual/manual-logging-controls';
import { ManualSheetLauncher } from '@/components/logging/input/manual/sheet/manual-sheet-launcher';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { readDraft } from '@/lib/domain/logging/meal-input-draft';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

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
      onManualSave,
    },
    ref
  ) {
    const t = useTranslations('logging');
    const isMobile = useIsMobile();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const isManual = mode === 'manual';
    const isCheat = mode === 'cheat';
    // Manual mode on a phone hands the plate to the stacked sheets.
    const sheetSave = isManual && isMobile ? onManualSave : undefined;

    const {
      textareaRef,
      manualRows,
      manualName,
      setManualName,
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
      <div className="relative flex flex-col gap-2 rounded-2xl border border-kallo-border/40 bg-card p-3 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-kallo-accent)_6%,transparent)] transition-all duration-300 focus-within:border-kallo-accent/40 focus-within:shadow-[0_4px_20px_color-mix(in_srgb,var(--color-kallo-accent)_12%,transparent)]">
        {popupSlot}

        {/* Manual mode: DB-backed ingredient rows */}
        {isManual && !sheetSave && (
          <ManualLoggingControls
            disabled={disabled}
            name={manualName}
            onNameChange={setManualName}
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
                <ComposerBarcode
                  selectedDate={selectedDate}
                  disabled={disabled}
                  onSuccess={onBarcodeSuccess}
                />
              )}
            </>
          )}

          {sheetSave ? (
            <ManualSheetLauncher
              open={isSheetOpen}
              onOpenChange={setIsSheetOpen}
              disabled={disabled}
              onSave={sheetSave}
            />
          ) : (
            isManual && <div className="flex-1" />
          )}

          {onModeChange && (
            <CheatModePicker
              mode={mode}
              intensity={cheatIntensity ?? 'medium'}
              disabled={disabled}
              onChangeMode={(next) => {
                onModeChange(next);
                // On a phone, picking Manual is a request to log one now.
                setIsSheetOpen(next === 'manual' && isMobile && !!onManualSave);
              }}
              onChangeIntensity={(next) => onChangeIntensity?.(next)}
            />
          )}
          {/* The sheet has its own Save; an idle send beside it would mislead. */}
          {!sheetSave && (
            <ComposerSendButton
              showStop={Boolean(disabled && onCancel)}
              canSubmit={canSubmit}
              onSubmit={onSubmit}
              onCancel={onCancel}
            />
          )}
        </div>
      </div>
    );
  }
);
