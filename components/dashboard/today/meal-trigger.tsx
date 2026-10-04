'use client';

import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { MealTriggerNotice } from '@/components/dashboard/today/meal-trigger-notice';
import { StreamTicker } from '@/components/shared/stream-ticker/stream-ticker';
import type { DashboardMealStream } from '@/hooks/dashboard/use-dashboard-meal-log';
import { cn } from '@/lib/core/ui/cn';

interface MealTriggerProps {
  /** In-place submit — the bar itself streams the analysis. */
  onSubmitMeal: (text: string) => void;
  streaming: DashboardMealStream;
  /** A dismissed-error draft to hand back to the input (identity-keyed). */
  restoredDraft?: { text: string } | null;
}

interface MealInputFormProps extends MealTriggerProps {
  id: string;
}

function MealInputForm({
  id,
  onSubmitMeal,
  streaming,
  restoredDraft,
}: MealInputFormProps) {
  const tm = useTranslations('dashboard.mealTrigger');
  const tl = useTranslations('logging');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wasActiveRef = useRef(false);

  const isStreaming = streaming.isActive;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const meal = text.trim();
    if (!meal || isStreaming || streaming.error) return;
    setText('');
    onSubmitMeal(meal);
  };

  useEffect(() => {
    if (!restoredDraft) return;
    setText(restoredDraft.text);
    inputRef.current?.focus();
  }, [restoredDraft]);

  // Hand focus back to the field once a run finishes cleanly (zero-click next log).
  useEffect(() => {
    if (wasActiveRef.current && !isStreaming && !streaming.error) {
      inputRef.current?.focus();
    }
    wasActiveRef.current = isStreaming;
  }, [isStreaming, streaming.error]);

  const isStreamingLive = isStreaming && !streaming.error;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-2xl px-3 transition-colors',
        'h-12',
        isStreamingLive
          ? 'border border-transparent'
          : 'border border-kallo-border/70 bg-card shadow-none focus-within:border-kallo-accent/50 hover:border-kallo-accent/50',
        streaming.error && 'border-kallo-danger/40'
      )}
    >
      {streaming.error ? (
        <MealTriggerNotice streaming={streaming} />
      ) : isStreaming ? (
        /* The bar becomes the stream: a loader + a line flipping through the
           stage's action verbs, then through dishes as they resolve. */
        <StreamTicker
          frame={streaming.ticker}
          loaderIndex={streaming.loaderIndex}
          className="flex-1"
        />
      ) : (
        <>
          <label htmlFor={id} className="sr-only">
            {tl('placeholder')}
          </label>
          <input
            id={id}
            ref={inputRef}
            type="text"
            placeholder={tl('placeholder')}
            maxLength={300}
            className="min-w-0 flex-1 bg-transparent text-kallo-text text-sm outline-none placeholder:text-kallo-text-muted"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="submit"
            aria-label={tm('send')}
            disabled={text.trim().length === 0}
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-kallo-btn text-white transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-kallo-btn-hover disabled:bg-kallo-track disabled:text-kallo-text-muted"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </>
      )}
    </form>
  );
}

export function InlineMealTrigger(props: MealTriggerProps) {
  return <MealInputForm id="dashboard-inline-meal-input" {...props} />;
}
