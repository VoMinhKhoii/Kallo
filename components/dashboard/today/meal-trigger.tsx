'use client';

import { ArrowUp, UtensilsCrossed, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DashboardMealStream } from '@/components/dashboard/use-dashboard-meal-log';
import { DASH_LOADERS } from '@/components/shared/svg-loaders';
import { cn } from '@/lib/utils';

interface MealTriggerProps {
  /** In-place submit — the bar itself streams the analysis. */
  onSubmitMeal: (text: string) => void;
  streaming: DashboardMealStream;
  /** A dismissed-error draft to hand back to the input (identity-keyed). */
  restoredDraft?: { text: string } | null;
}

interface MealInputFormProps extends MealTriggerProps {
  id: string;
  autoFocus?: boolean;
  compact?: boolean;
  onSubmit?: () => void;
}

function MealInputForm({
  id,
  autoFocus = false,
  compact = false,
  onSubmit,
  onSubmitMeal,
  streaming,
  restoredDraft,
}: MealInputFormProps) {
  const tm = useTranslations('dashboard.mealTrigger');
  const td = useTranslations('dashboard');
  const tl = useTranslations('logging');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const wasActiveRef = useRef(false);

  const isStreaming = streaming.isActive;
  const showTicker = isStreaming || Boolean(streaming.error);
  const Loader = DASH_LOADERS[streaming.loaderIndex % DASH_LOADERS.length];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const meal = text.trim();
    if (!meal || showTicker) return;
    onSubmit?.();
    setText('');
    onSubmitMeal(meal);
  };

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!restoredDraft) return;
    setText(restoredDraft.text);
    inputRef.current?.focus();
  }, [restoredDraft]);

  // Hand focus back to the field once a run finishes cleanly, so logging the
  // next meal is zero-click.
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
        compact ? 'h-11' : 'h-12',
        // While streaming, the box chrome falls away — just the loader and
        // the flipping text on the page surface.
        isStreamingLive
          ? 'border border-transparent'
          : 'border border-nham-border/70 bg-card shadow-none focus-within:border-nham-accent/50 hover:border-nham-accent/50',
        streaming.error && 'border-nham-danger/40'
      )}
    >
      {streaming.error ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            role="alert"
            className="min-w-0 flex-1 truncate text-nham-danger text-sm"
          >
            {streaming.error}
          </span>
          <button
            type="button"
            onClick={streaming.onRetry}
            className="shrink-0 font-medium text-nham-btn text-xs underline-offset-2 hover:underline"
          >
            {td('retry')}
          </button>
          <button
            type="button"
            onClick={streaming.onDismiss}
            className="shrink-0 text-nham-text-muted text-xs underline-offset-2 hover:underline"
          >
            {td('streaming.dismiss')}
          </button>
        </div>
      ) : isStreaming ? (
        /* The bar becomes the stream: one loader for the whole run, the text
           flipping in place as stages, item names, and macros arrive. Stage
           labels stay quiet sans; the meal's own words flip in serif italic
           with the resolved kcal in muted ink. */
        <div
          aria-live="polite"
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-nham-text-muted">
            <Loader size={20} />
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={streaming.ticker?.key ?? 'connecting'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'min-w-0 truncate text-sm',
                streaming.ticker && streaming.ticker.kind !== 'phase'
                  ? 'font-serif text-nham-text italic'
                  : 'text-nham-text-muted'
              )}
            >
              {streaming.ticker?.text ?? tm('analyzing')}
              {streaming.ticker?.detail && (
                <span className="ml-1.5 font-sans text-nham-text-muted not-italic tabular-nums">
                  · {streaming.ticker.detail}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </div>
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
            className="min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-text-muted"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="submit"
            aria-label={tm('send')}
            disabled={text.trim().length === 0}
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nham-btn text-white transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-nham-btn-hover disabled:bg-nham-track disabled:text-nham-text-muted"
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

export function FloatingMealTrigger(props: MealTriggerProps) {
  const t = useTranslations('dashboard');
  const tm = useTranslations('dashboard.mealTrigger');
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setExpanded(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [expanded, handleClose]);

  return (
    <div className="md:hidden">
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="meal-input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16 }}
            className="fixed right-4 bottom-20 left-4 z-50"
          >
            {/* Stays open on submit so the in-bar stream is visible; Esc or
                the FAB dismiss it. */}
            <MealInputForm
              id="dashboard-floating-meal-input"
              autoFocus
              compact
              {...props}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        onClick={expanded ? handleClose : () => setExpanded(true)}
        aria-label={expanded ? tm('close') : t('logMeal')}
        aria-expanded={expanded}
        className="fixed right-4 bottom-5 z-50 flex h-11 w-11 items-center justify-center rounded-2xl bg-nham-btn text-white shadow-[0_4px_16px_rgba(44,36,22,0.18)] transition-colors hover:bg-nham-btn-hover"
      >
        {expanded ? (
          <X className="h-5 w-5" />
        ) : (
          <UtensilsCrossed className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
