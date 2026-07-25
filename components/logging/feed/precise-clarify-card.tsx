'use client';

import { CornerDownLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { TimeDivider } from '@/components/logging/feed/time-divider';

interface PreciseClarifyCardProps {
  /** The user's original meal text, shown as the serif quote. */
  rawInput?: string;
  /** The AI's single targeted question (already localized server-side). */
  question: string;
  timestamp: Date;
  /** Disabled while a resubmit is already in flight. */
  isBusy?: boolean;
  /** Re-analyze the same meal with the typed answer. */
  onSubmit: (answer: string) => void;
  /** Drop the card; the raw text is restored to the composer to re-log. */
  onDiscard: () => void;
}

/**
 * Precise-mode clarify prompt, rendered as a feed card. The pipeline finished
 * but an ingredient's portion/food couldn't be resolved, so the server asked
 * ONE targeted question and staged nothing. The user types a short answer and
 * re-submits the SAME meal with `clarifyAnswer` (reusing the attempt id).
 *
 * Mirrors the cheat clarify-question card (raw-input quote + question), but the
 * answer is free text — the precise path carries no option chips.
 */
export function PreciseClarifyCard({
  rawInput,
  question,
  timestamp,
  isBusy,
  onSubmit,
  onDiscard,
}: PreciseClarifyCardProps) {
  const t = useTranslations('logging');
  const locale = useLocale();
  const [answer, setAnswer] = useState('');

  const timeLabel = timestamp.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const trimmed = answer.trim();
  const canSubmit = trimmed.length > 0 && !isBusy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      <TimeDivider timeLabel={timeLabel} />

      <div className="rounded-2xl border border-nham-border/60 bg-white p-4 shadow-sm sm:p-5">
        {rawInput && (
          <p className="mb-3 font-serif text-[17px] text-nham-text leading-relaxed sm:text-[19px]">
            {rawInput}
          </p>
        )}

        {/* The AI's single targeted question. */}
        <p className="mb-3 font-sans-display text-nham-text text-sm">
          {question}
        </p>

        <input
          type="text"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          disabled={isBusy}
          placeholder={t('clarify.answerHint')}
          aria-label={question}
          // biome-ignore lint/a11y/noAutofocus: the card exists solely to collect this answer.
          autoFocus
          className="w-full rounded-xl border border-nham-border/60 bg-white px-3 py-2.5 font-sans-display text-nham-text text-sm placeholder:text-nham-text-muted focus:border-nham-accent/60 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          aria-busy={isBusy}
          onClick={submit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-nham-btn py-2.5 font-medium font-sans-display text-sm text-white transition-colors hover:bg-nham-btn-hover disabled:opacity-50"
        >
          <CornerDownLeft className="h-3.5 w-3.5" />
          {t('clarify.send')}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-xl px-4 py-2.5 font-medium font-sans-display text-nham-text-muted text-sm transition-colors hover:bg-nham-hover/40 hover:text-nham-text"
        >
          {t('discard')}
        </button>
      </div>
    </motion.article>
  );
}
