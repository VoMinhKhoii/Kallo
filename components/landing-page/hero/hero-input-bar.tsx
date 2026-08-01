'use client';

import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HERO_CHIP_IDS } from '@/components/landing-page/hero/hero-demo-fixtures';
import type { HeroDemo } from '@/hooks/landing/use-hero-demo';

/**
 * The hero phone's input bar: quick-pick chips plus the text field that
 * becomes real once the canned demo finishes. Presentation only — all state
 * lives in `useHeroDemo`.
 */
export function HeroInputBar({
  demo,
  disabled,
}: {
  demo: HeroDemo;
  disabled: boolean;
}) {
  const t = useTranslations('landing.hero');
  const {
    phase,
    interactive,
    inputValue,
    setInputValue,
    isAnalyzing,
    submitText,
    selectChip,
  } = demo;

  return (
    <div className="absolute right-4 bottom-5 left-4 z-20 sm:right-5 sm:bottom-6 sm:left-5">
      {interactive && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {HERO_CHIP_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectChip(id)}
              disabled={isAnalyzing || phase === 'typing'}
              className="rounded-full border border-nham-border/60 bg-white/90 px-2.5 py-1 font-medium text-[10px] text-nham-text-muted shadow-sm backdrop-blur-sm transition-colors hover:border-nham-accent hover:text-nham-text disabled:opacity-50 sm:text-[11px]"
            >
              {t(`demo.chips.${id}`)}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitText(inputValue);
        }}
        className="flex h-12 items-center justify-between rounded-full border border-nham-border/30 bg-white px-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] focus-within:border-nham-accent focus-within:ring-2 focus-within:ring-nham-accent/40 sm:h-14 sm:pl-5"
      >
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={disabled}
          placeholder={t('demo.inputPlaceholder')}
          aria-label={t('demo.inputPlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-text-muted/70 disabled:cursor-default sm:text-base"
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label={t('demo.send')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nham-ink shadow-lg transition-transform active:scale-95 disabled:opacity-50 sm:h-10 sm:w-10"
        >
          <ArrowRight className="h-4 w-4 text-white" />
        </button>
      </form>
    </div>
  );
}
