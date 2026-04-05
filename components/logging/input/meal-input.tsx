'use client';

import { ArrowUp } from 'lucide-react';
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

export const MealInput = forwardRef<MealInputHandle, MealInputProps>(
  function MealInput({ onSubmit, disabled }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
    const [hasContent, setHasContent] = useState(() => readDraft().length > 0);

    const updateText = useCallback((text: string) => {
      const el = textareaRef.current;
      if (el) {
        el.value = text;
      }
      setHasContent(text.trim().length > 0);
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
        const empty = el.value.trim().length === 0;
        setHasContent(!empty);

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
        onSubmit();
      }
    };

    const canSubmit = hasContent && !disabled;

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-nham-border/40 bg-white p-3 shadow-[0_4px_20px_rgba(201,168,124,0.06)] transition-all duration-300 focus-within:border-nham-accent/40 focus-within:shadow-[0_4px_20px_rgba(201,168,124,0.12)]">
        <label htmlFor="meal-input" className="sr-only">
          Describe your meal
        </label>
        <textarea
          ref={textareaRef}
          id="meal-input"
          rows={1}
          defaultValue={readDraft()}
          onKeyDown={handleKeyDown}
          placeholder="Describe your meal..."
          disabled={disabled}
          className="flex-1 resize-none bg-transparent font-normal text-nham-text text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nham-btn text-white transition-all duration-200 hover:bg-nham-btn-hover active:scale-95 disabled:opacity-30"
          aria-label="Submit meal"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    );
  }
);
