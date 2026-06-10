'use client';

import { ArrowUp, Square } from 'lucide-react';
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
import { ManualEstimationControls } from '@/components/logging/input/manual-estimation-controls';
import {
  buildManualLoggingRequest,
  createDefaultManualItem,
  createDefaultManualLoggingFormState,
  hasCompleteItem,
  type ManualLoggingContext,
  type ManualLoggingFormState,
  type MealContext,
  serializeItemsToText,
} from '@/lib/logging/manual-estimation';
import type { CheatIntensity } from '@/lib/types/cheat';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'nham:meal-input-draft';
const MANUAL_ITEMS_KEY = 'nham:meal-input-manual-items';
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
  getManualLogging: () => ManualLoggingContext | Record<string, unknown>;
  clear: () => void;
  focus: () => void;
  setText: (text: string) => void;
}

interface MealInputProps {
  onSubmit: () => void;
  /** When provided and the input is disabled (analysis in flight), the
   * submit button is replaced with a stop button that calls this. */
  onCancel?: () => void;
  disabled?: boolean;
  /** Current input mode: normal | manual | cheat. Controlled from outside. */
  mode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  /** Indulgence magnitude shown in the mode picker (cheat mode). */
  cheatIntensity?: CheatIntensity;
  onChangeIntensity?: (next: CheatIntensity) => void;
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

function readManualItemsDraft(): ManualLoggingFormState['items'] {
  try {
    const raw = localStorage.getItem(MANUAL_ITEMS_KEY);
    if (!raw) return [createDefaultManualItem(crypto.randomUUID())];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [createDefaultManualItem(crypto.randomUUID())];
}

function writeManualItemsDraft(items: ManualLoggingFormState['items']) {
  try {
    const filled = items.filter((i) => i.qty.trim() || i.name.trim());
    if (filled.length === 0) {
      localStorage.removeItem(MANUAL_ITEMS_KEY);
    } else {
      localStorage.setItem(MANUAL_ITEMS_KEY, JSON.stringify(items));
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
    },
    ref
  ) {
    const t = useTranslations('logging');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [hasContent, setHasContent] = useState(() =>
      hasMeaningfulText(readDraft())
    );
    const [manualState, setManualState] = useState<ManualLoggingFormState>(() =>
      createDefaultManualLoggingFormState()
    );
    // Track previous mode to react to transitions.
    const prevModeRef = useRef<InputMode>(mode);
    const manualStateRef = useRef(manualState);
    manualStateRef.current = manualState;
    // Mirrors the textarea's current text value so we can read it even after the
    // textarea unmounts (which happens before effects fire on a mode transition).
    const textValueRef = useRef(readDraft());

    const isManual = mode === 'manual';
    const isCheat = mode === 'cheat';

    const updateText = useCallback((text: string) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
        autoResize(el);
      }
      textValueRef.current = text;
      setHasContent(hasMeaningfulText(text));
      writeDraft(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    // Handle mode transitions: pre-fill items from textarea when going to manual,
    // serialize items back to textarea when leaving manual.
    useEffect(() => {
      const prevMode = prevModeRef.current;
      prevModeRef.current = mode;
      if (prevMode === mode) return;

      if (mode === 'manual' && prevMode !== 'manual') {
        const currentText = textValueRef.current.trim();
        const savedItems = readManualItemsDraft();
        const items = currentText
          ? [{ id: crypto.randomUUID(), qty: '', name: currentText }]
          : savedItems;
        setManualState((prev) => ({ ...prev, items }));
      } else if (mode !== 'manual' && prevMode === 'manual') {
        const serialized = serializeItemsToText(manualStateRef.current.items);
        updateText(serialized);
      }
    }, [mode, updateText]);

    useImperativeHandle(
      ref,
      () => ({
        getText: () => {
          if (isManual) return serializeItemsToText(manualState.items);
          return textareaRef.current?.value ?? '';
        },
        getManualLogging: () => buildManualLoggingRequest(manualState, isManual),
        clear: () => {
          if (isManual) {
            const emptyItem = createDefaultManualItem(crypto.randomUUID());
            setManualState((prev) => ({ ...prev, items: [emptyItem] }));
            writeManualItemsDraft([]);
          } else {
            updateText('');
          }
        },
        focus: () => textareaRef.current?.focus(),
        setText: (text: string) => {
          updateText(text);
        },
      }),
      [isManual, manualState, updateText]
    );

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;

      autoResize(el);

      const flushDraft = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        writeDraft(el.value);
        writeManualItemsDraft(manualStateRef.current.items);
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
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Persist manual items draft on change.
    useEffect(() => {
      if (!isManual) return;
      const timer = setTimeout(() => {
        writeManualItemsDraft(manualState.items);
      }, DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }, [isManual, manualState.items]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      autoResize(el);
      textValueRef.current = el.value;
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

    const handleItemChange = (
      id: string,
      field: 'qty' | 'name',
      value: string
    ) => {
      setManualState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      }));
    };

    const handleItemAdd = (afterId?: string): string => {
      const newId = crypto.randomUUID();
      setManualState((prev) => {
        const newItem = createDefaultManualItem(newId);
        if (!afterId) {
          return { ...prev, items: [...prev.items, newItem] };
        }
        const idx = prev.items.findIndex((i) => i.id === afterId);
        const next = [...prev.items];
        next.splice(idx + 1, 0, newItem);
        return { ...prev, items: next };
      });
      return newId;
    };

    const handleItemRemove = (id: string) => {
      setManualState((prev) => {
        const next = prev.items.filter((i) => i.id !== id);
        return {
          ...prev,
          items:
            next.length > 0
              ? next
              : [createDefaultManualItem(crypto.randomUUID())],
        };
      });
    };

    const canSubmit =
      !disabled &&
      (isManual ? hasCompleteItem(manualState.items) : hasContent);
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
        {/* Manual mode: item list */}
        {isManual && (
          <ManualEstimationControls
            disabled={disabled}
            state={manualState}
            onMealContextChange={(mealContext: MealContext | null) =>
              setManualState((prev) => ({ ...prev, mealContext }))
            }
            onItemChange={handleItemChange}
            onItemAdd={handleItemAdd}
            onItemRemove={handleItemRemove}
          />
        )}

        {/* Textarea — shown for normal and cheat mode */}
        {!isManual && (
          <label htmlFor="meal-input" className="sr-only">
            {placeholder}
          </label>
        )}
        <textarea
          ref={textareaRef}
          id="meal-input"
          rows={1}
          defaultValue={readDraft()}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-hidden={isManual || undefined}
          className={cn(
            'flex-1 resize-none bg-transparent py-1.5 font-[var(--font-dm-sans)] font-normal text-nham-text text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50',
            isManual && 'hidden'
          )}
        />

        {/* Action row: picker + submit — always at the bottom, picker adjacent to send */}
        <div className="flex items-center gap-2">
          <div className="flex-1" />
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
      </div>
    );
  }
);
