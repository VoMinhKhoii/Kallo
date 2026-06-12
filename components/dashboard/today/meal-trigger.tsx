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
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface MealInputFormProps {
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
}: MealInputFormProps) {
  const tm = useTranslations('dashboard.mealTrigger');
  const tl = useTranslations('logging');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const meal = text.trim();
    if (!meal) return;
    onSubmit?.();
    setText('');
    router.push(`/logging?meal=${encodeURIComponent(meal)}`);
  };

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-2xl border border-nham-border/70 bg-card px-3 shadow-none transition-colors focus-within:border-nham-accent/50',
        compact ? 'h-11' : 'h-12'
      )}
    >
      <label htmlFor={id} className="sr-only">
        {tl('placeholder')}
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        placeholder={tl('placeholder')}
        maxLength={300}
        className="min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-stone"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="submit"
        aria-label={tm('send')}
        disabled={text.trim().length === 0}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nham-btn text-white transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-nham-btn-hover disabled:bg-nham-track disabled:text-nham-stone"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </form>
  );
}

export function InlineMealTrigger() {
  return <MealInputForm id="dashboard-inline-meal-input" />;
}

export function FloatingMealTrigger() {
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
            // Sit above the bottom tab bar (≈58px + safe-area) so the composer
            // never overlaps the nav.
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-4 z-50"
          >
            <MealInputForm
              id="dashboard-floating-meal-input"
              autoFocus
              compact
              onSubmit={handleClose}
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
        // Anchored above the bottom tab bar.
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-nham-btn text-white shadow-[0_4px_16px_rgba(44,36,22,0.18)] transition-colors hover:bg-nham-btn-hover"
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

export function MealTrigger() {
  return <FloatingMealTrigger />;
}
