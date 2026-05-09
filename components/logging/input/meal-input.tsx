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

const STORAGE_KEY = 'nham:meal-input-draft';
const DEBOUNCE_MS = 500;

export interface MealInputHandle {
  getText: () => string;
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

const hasMeaningfulText = (text: string) => text.trim().length > 0;

export const MealInput = forwardRef<MealInputHandle, MealInputProps>(
  function MealInput({ onSubmit, onCancel, disabled }, ref) {
    const t = useTranslations('logging');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [hasContent, setHasContent] = useState(() =>
      hasMeaningfulText(readDraft())
    );

    const updateText = useCallback((text: string) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
      }
      setHasContent(hasMeaningfulText(text));
      writeDraft(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    useImperativeHandle(ref, () => ({
      getText: () => textareaRef.current?.value ?? '',
      clear: () => {
        updateText('');
      },
      focus: () => textareaRef.current?.focus(),
      setText: (text: string) => {
        updateText(text);
      },
    }));

    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;

      const handleInput = () => {
        setHasContent(hasMeaningfulText(el.value));

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          writeDraft(el.value);
        }, DEBOUNCE_MS);
      };

      const flushDraft = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        writeDraft(el.value);
      };

      el.addEventListener('input', handleInput);
      window.addEventListener('beforeunload', flushDraft);

      return () => {
        el.removeEventListener('input', handleInput);
        window.removeEventListener('beforeunload', flushDraft);
        // Flush on unmount (covers in-app navigation)
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          writeDraft(el.value);
        }
      };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && hasMeaningfulText(textareaRef.current?.value ?? '')) {
          onSubmit();
        }
      }
    };

    const canSubmit = hasContent && !disabled;
    const showStopButton = Boolean(disabled && onCancel);

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-nham-border/40 bg-background p-3 shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_6%,transparent)] transition-all duration-300 focus-within:border-nham-accent/40 focus-within:shadow-[0_4px_20px_color-mix(in_srgb,var(--color-nham-accent)_12%,transparent)]">
        <label htmlFor="meal-input" className="sr-only">
          {t('placeholder')}
        </label>
        <textarea
          ref={textareaRef}
          id="meal-input"
          rows={1}
          defaultValue={readDraft()}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent font-[var(--font-dm-sans)] font-normal text-nham-text text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50"
        />
        {showStopButton ? (
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
        )}
      </div>
    );
  }
);
