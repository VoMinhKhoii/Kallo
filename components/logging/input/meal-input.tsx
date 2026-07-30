'use client';

import { ArrowUp, Barcode, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  CheatModePicker,
  type InputMode,
} from '@/components/logging/input/cheat-mode-picker';
import { ManualLoggingControls } from '@/components/logging/input/manual-logging-controls';
import {
  createEmptyRow,
  hasCompleteRow,
  type ManualMealRow,
} from '@/lib/logging/manual-logging';
import {
  autoResize,
  DRAFT_DEBOUNCE_MS,
  hasMeaningfulText,
  readDraft,
  readManualRowsDraft,
  writeDraft,
  writeManualRowsDraft,
} from '@/lib/logging/meal-input-draft';
import type { CheatIntensity } from '@/lib/types/cheat';
import { BarcodeScannerDialog } from './barcode-scanner-dialog';

export interface MealInputHandle {
  getText: () => string;
  getManualRows: () => ManualMealRow[];
  clear: () => void;
  focus: () => void;
  /** `caret` places the cursor after the write — used when a `/` mention token
   *  is spliced out mid-sentence, so the cursor stays where the token was
   *  instead of jumping to the end. Omit it to leave the caret alone. */
  setText: (text: string, caret?: number) => void;
  /** The raw element, for callers that need `value` + `selectionStart` (the
   *  relog `/` picker). Exposed rather than lifting the text into React state,
   *  which would cost the uncontrolled textarea its draft/resize/IME behaviour. */
  getTextarea: () => HTMLTextAreaElement | null;
}

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
    },
    ref
  ) {
    const t = useTranslations('logging');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);
    const [hasContent, setHasContent] = useState(() =>
      hasMeaningfulText(readDraft())
    );
    const [manualRows, setManualRows] = useState<ManualMealRow[]>(() =>
      readManualRowsDraft()
    );
    const manualRowsRef = useRef(manualRows);
    manualRowsRef.current = manualRows;

    const isManual = mode === 'manual';
    const isCheat = mode === 'cheat';

    const updateText = useCallback((text: string, caret?: number) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
        if (caret !== undefined) el.setSelectionRange(caret, caret);
        autoResize(el);
      }
      setHasContent(hasMeaningfulText(text));
      writeDraft(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getText: () => textareaRef.current?.value ?? '',
        // Read through the ref so the handle isn't rebuilt on every keystroke.
        getManualRows: () => manualRowsRef.current,
        clear: () => {
          if (isManual) {
            setManualRows([createEmptyRow(crypto.randomUUID())]);
            writeManualRowsDraft([]);
          } else {
            updateText('');
          }
        },
        focus: () => textareaRef.current?.focus(),
        setText: (text: string, caret?: number) => {
          updateText(text, caret);
        },
        getTextarea: () => textareaRef.current,
      }),
      [isManual, updateText]
    );

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;

      autoResize(el);

      const flushDraft = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        writeDraft(el.value);
        writeManualRowsDraft(manualRowsRef.current);
      };

      window.addEventListener('beforeunload', flushDraft);

      return () => {
        window.removeEventListener('beforeunload', flushDraft);
        // Flush on unmount (covers in-app navigation)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          writeDraft(el.value);
        }
      };
    }, []);

    // Persist manual rows draft on change.
    useEffect(() => {
      if (!isManual) return;
      const timer = setTimeout(() => {
        writeManualRowsDraft(manualRows);
      }, DRAFT_DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }, [isManual, manualRows]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      autoResize(el);
      setHasContent(hasMeaningfulText(el.value));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        writeDraft(el.value);
      }, DRAFT_DEBOUNCE_MS);
      onTextareaSync?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // IME guard first: during a Telex composition, Enter commits the
      // composition and must reach neither the overlay nor submit.
      if (e.nativeEvent.isComposing) return;
      // An overlay (the `/` picker) gets first refusal. When it consumes the
      // key the submit path below is skipped entirely; when nothing is open
      // this is a no-op and Enter behaves exactly as it always has.
      if (onTextareaKeyDown?.(e)) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const canSubmitNow =
          hasExternalContent ||
          hasMeaningfulText(textareaRef.current?.value ?? '');
        if (!disabled && canSubmitNow) {
          onSubmit();
        }
      }
    };

    const handleRowChange = (
      id: string,
      patch: Partial<Omit<ManualMealRow, 'id'>>
    ) => {
      setManualRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    };

    const handleRowAdd = (afterId?: string): string => {
      const newId = crypto.randomUUID();
      setManualRows((prev) => {
        const newRow = createEmptyRow(newId);
        // Prepend: new rows appear at the top so the list grows upward toward
        // the "Add food" button above it.
        if (!afterId) return [newRow, ...prev];
        const idx = prev.findIndex((row) => row.id === afterId);
        const next = [...prev];
        next.splice(idx + 1, 0, newRow);
        return next;
      });
      return newId;
    };

    const handleRowRemove = (id: string) => {
      setManualRows((prev) => {
        const next = prev.filter((row) => row.id !== id);
        return next.length > 0 ? next : [createEmptyRow(crypto.randomUUID())];
      });
    };

    const canSubmit =
      !disabled &&
      (isManual
        ? hasCompleteRow(manualRows)
        : hasContent || Boolean(hasExternalContent));
    const showStopButton = Boolean(disabled && onCancel);

    const submitButton = showStopButton ? (
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nham-btn text-white transition-all duration-200 hover:bg-nham-btn-hover active:scale-95"
        aria-label={t('stopAnalyzing')}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    ) : (
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nham-btn text-white transition-all duration-200 hover:bg-nham-btn-hover active:scale-95 disabled:opacity-30"
        aria-label={t('submit')}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    );

    const placeholder = isCheat ? t('cheatPlaceholder') : t('placeholder');

    return (
      /* `relative` anchors popupSlot, which opens upward over the feed. */
      <div className="relative flex flex-col gap-2 rounded-2xl border border-nham-border/40 bg-white p-3 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_6%,transparent)] transition-all duration-300 focus-within:border-nham-accent/40 focus-within:shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_12%,transparent)]">
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
              {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the
                  combobox aria-* below are gated on the same `isPopupOpen` as
                  role="combobox", which the rule cannot see statically. The
                  invalid pairing (combobox aria on a plain textarea) never
                  actually renders. This is the standard ARIA "mention" pattern:
                  a combobox nested inside a free-text field. */}
              <textarea
                ref={textareaRef}
                id="meal-input"
                rows={1}
                defaultValue={readDraft()}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                // Caret can move without the value changing (arrows, clicks),
                // and an overlay keyed off the caret has to see that.
                onKeyUp={onTextareaSync}
                onClick={onTextareaSync}
                placeholder={placeholder}
                disabled={disabled}
                // Combobox semantics only WHILE a popup is open: announcing the
                // composer as a combobox permanently would mislabel its primary
                // use, which is free-text meal entry. This is the standard ARIA
                // "mention" pattern — a combobox nested in a free-text field.
                role={isPopupOpen ? 'combobox' : undefined}
                aria-expanded={isPopupOpen ? true : undefined}
                aria-controls={isPopupOpen ? popupListboxId : undefined}
                aria-autocomplete={isPopupOpen ? 'list' : undefined}
                aria-activedescendant={
                  isPopupOpen ? popupActiveDescendantId : undefined
                }
                className="flex-1 resize-none bg-transparent py-1.5 font-[var(--font-dm-sans)] font-normal text-nham-text text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50"
              />
              {selectedDate && onBarcodeSuccess && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setIsBarcodeOpen(true)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nham-border/40 text-nham-text-muted transition-all duration-200 hover:bg-nham-hover hover:text-nham-text active:scale-95 disabled:opacity-30"
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
          {submitButton}
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
