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
import type { CheatIntensity } from '@/lib/types/cheat';
import { BarcodeScannerDialog } from './barcode-scanner-dialog';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'nham:meal-input-draft';
// v3: rows are {id, query, ingredient, grams} — `query` is the raw typed text.
// Older shapes (v2 {id, ingredient, grams}, pre-rework {id, qty, name}) are
// incompatible and their keys are deleted on first read.
const MANUAL_ROWS_KEY = 'nham:meal-input-manual-items-v3';
const LEGACY_MANUAL_ITEMS_KEYS = [
  'nham:meal-input-manual-items',
  'nham:meal-input-manual-items-v2',
];
const DEBOUNCE_MS = 500;
// Single-line height matches the submit button (h-8 = 32px) so the placeholder
// sits on the button's vertical centerline. Above MAX, textarea scrolls itself.
const MIN_INPUT_HEIGHT_PX = 32;
const MAX_INPUT_HEIGHT_PX = 200;

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = '0px';
  const measured = el.scrollHeight;
  const next = Math.max(
    MIN_INPUT_HEIGHT_PX,
    Math.min(measured, MAX_INPUT_HEIGHT_PX)
  );
  el.style.height = `${next}px`;
  el.style.overflowY = measured > MAX_INPUT_HEIGHT_PX ? 'auto' : 'hidden';
}

export interface MealInputHandle {
  getText: () => string;
  getManualRows: () => ManualMealRow[];
  clear: () => void;
  focus: () => void;
  setText: (text: string) => void;
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
}

function readDraft(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(text: string) {
  try {
    if (text) {
      localStorage.setItem(STORAGE_KEY, text);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (incognito, quota exceeded)
  }
}

function isValidManualRow(value: unknown): value is ManualMealRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.query !== 'string' ||
    typeof row.grams !== 'string'
  ) {
    return false;
  }
  if (row.ingredient === null) return true;
  if (typeof row.ingredient !== 'object') return false;
  const ingredient = row.ingredient as Record<string, unknown>;
  return (
    typeof ingredient.id === 'string' &&
    typeof ingredient.namePrimary === 'string' &&
    typeof ingredient.per100g === 'object' &&
    ingredient.per100g !== null
  );
}

function readManualRowsDraft(): ManualMealRow[] {
  try {
    for (const key of LEGACY_MANUAL_ITEMS_KEYS) localStorage.removeItem(key);
    const raw = localStorage.getItem(MANUAL_ROWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(isValidManualRow)
      ) {
        return parsed;
      }
    }
  } catch {}
  return [createEmptyRow(crypto.randomUUID())];
}

function writeManualRowsDraft(rows: ManualMealRow[]) {
  try {
    const filled = rows.filter(
      (row) => row.ingredient || row.query.trim() || row.grams.trim()
    );
    if (filled.length === 0) {
      localStorage.removeItem(MANUAL_ROWS_KEY);
    } else {
      localStorage.setItem(MANUAL_ROWS_KEY, JSON.stringify(rows));
    }
  } catch {}
}

const hasMeaningfulText = (text: string) => text.trim().length > 0;

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

    const updateText = useCallback((text: string) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
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
        setText: (text: string) => {
          updateText(text);
        },
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
      }, DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }, [isManual, manualRows]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      autoResize(el);
      setHasContent(hasMeaningfulText(el.value));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        writeDraft(el.value);
      }, DEBOUNCE_MS);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && hasMeaningfulText(textareaRef.current?.value ?? '')) {
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
      !disabled && (isManual ? hasCompleteRow(manualRows) : hasContent);
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
      <div className="flex flex-col gap-2 rounded-2xl border border-nham-border/40 bg-background p-3 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_6%,transparent)] transition-all duration-300 focus-within:border-nham-accent/40 focus-within:shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_12%,transparent)]">
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

        {/* Textarea — shown for normal and cheat mode */}
        {!isManual && (
          <div className="flex items-center gap-2">
            <label htmlFor="meal-input" className="sr-only">
              {placeholder}
            </label>
            <textarea
              ref={textareaRef}
              id="meal-input"
              rows={1}
              defaultValue={readDraft()}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
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
        )}
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
