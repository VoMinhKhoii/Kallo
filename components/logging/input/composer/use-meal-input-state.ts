'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  createEmptyRow,
  hasCompleteRow,
  type ManualMealRow,
} from '@/lib/domain/logging/manual-logging';
import {
  autoResize,
  DRAFT_DEBOUNCE_MS,
  hasMeaningfulText,
  readDraft,
  readManualRowsDraft,
  writeDraft,
  writeManualRowsDraft,
} from '@/lib/domain/logging/meal-input-draft';
import type { MealInputHandle } from '@/lib/domain/logging/meal-input-handle';

interface UseMealInputStateOptions {
  /** Manual mode swaps the textarea for ingredient rows, so `clear()` and the
   *  rows draft only act while it is on. */
  isManual: boolean;
  disabled?: boolean;
  hasExternalContent?: boolean;
  onSubmit: () => void;
  onTextareaSync?: () => void;
  onTextareaKeyDown?: (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => boolean;
}

/** Everything the composer remembers: the uncontrolled textarea and its
 *  debounced draft, the manual ingredient rows and theirs, and the imperative
 *  handle the feed drives it through. Presentation stays in `meal-input.tsx`. */
export function useMealInputState(
  ref: React.ForwardedRef<MealInputHandle>,
  {
    isManual,
    disabled,
    hasExternalContent,
    onSubmit,
    onTextareaSync,
    onTextareaKeyDown,
  }: UseMealInputStateOptions
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [hasContent, setHasContent] = useState(() =>
    hasMeaningfulText(readDraft())
  );
  const [manualRows, setManualRows] = useState<ManualMealRow[]>(() =>
    readManualRowsDraft()
  );
  const manualRowsRef = useRef(manualRows);
  manualRowsRef.current = manualRows;

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

  return {
    textareaRef,
    manualRows,
    canSubmit,
    handleChange,
    handleKeyDown,
    handleRowChange,
    handleRowAdd,
    handleRowRemove,
  };
}
