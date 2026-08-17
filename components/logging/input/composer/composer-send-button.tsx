'use client';

import { ArrowUp, Square } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ComposerSendButtonProps {
  /** An analysis is in flight and cancellable — the send affordance becomes a
   *  stop button rather than a disabled send. */
  showStop: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
}

export function ComposerSendButton({
  showStop,
  canSubmit,
  onSubmit,
  onCancel,
}: ComposerSendButtonProps) {
  const t = useTranslations('logging');

  if (showStop) {
    return (
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kallo-btn text-white transition-all duration-200 hover:bg-kallo-btn-hover active:scale-95"
        aria-label={t('stopAnalyzing')}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSubmit}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-kallo-btn text-white transition-all duration-200 hover:bg-kallo-btn-hover active:scale-95 disabled:opacity-30"
      aria-label={t('submit')}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
