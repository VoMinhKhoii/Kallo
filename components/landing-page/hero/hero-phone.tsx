'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { HERO_CHIP_IDS } from '@/components/landing-page/hero/hero-demo-fixtures';
import { HeroResultCard } from '@/components/landing-page/hero/hero-result-card';
import type { HeroDemo } from '@/hooks/landing/use-hero-demo';

/**
 * The phone mock on the right of the hero: chat stream, staged loading copy,
 * the result card, and an input bar that becomes real once the canned demo
 * finishes. All state lives in `useHeroDemo`; this file is presentation only.
 */
export function HeroPhone({
  demo,
  onSave,
}: {
  demo: HeroDemo;
  onSave: () => void;
}) {
  const t = useTranslations('landing.hero');
  const prefersReducedMotion = useReducedMotion();
  const {
    fixture,
    phase,
    typedText,
    interactive,
    inputValue,
    setInputValue,
    isAnalyzing,
    showResult,
    submitText,
    selectChip,
  } = demo;
  const inputDisabled = !interactive || isAnalyzing || phase === 'typing';

  return (
    <div className="relative mx-auto w-full max-w-[380px] sm:max-w-[400px]">
      <div className="relative h-[620px] w-full overflow-hidden rounded-[3rem] border-[8px] border-white bg-white shadow-[0_30px_60px_-15px_rgba(201,168,124,0.25)] ring-1 ring-nham-border/50 sm:h-[650px] lg:h-[680px]">
        {/* Status Bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between bg-white/90 px-6 backdrop-blur-md">
          <div className="font-semibold text-nham-text text-xs tracking-wider">
            9:41
          </div>
          <div className="flex gap-1.5">
            <div className="h-4 w-4 rounded-full bg-nham-ink" />
            <div className="h-4 w-4 rounded-full border border-nham-ink" />
          </div>
        </div>

        {/* Main App Content */}
        <div className="absolute inset-0 flex flex-col overflow-hidden bg-[#FAF9F7] px-5 pt-16 pb-24">
          <div className="text-center">
            <p className="mb-1 font-medium text-nham-text-muted text-xs uppercase tracking-widest">
              {t('demo.today')}
            </p>
            <h3 className="font-serif text-nham-text text-xl sm:text-2xl">
              {t('demo.date')}
            </h3>
          </div>

          {/* Chat Stream */}
          <div className="flex min-h-0 flex-1 flex-col justify-end space-y-3 overflow-y-auto">
            <div className="max-w-[82%] self-end">
              <div className="rounded-3xl rounded-br-sm border border-nham-border/20 bg-nham-border/20 px-4 py-3 text-nham-text shadow-sm">
                <p className="break-words font-normal font-serif text-sm leading-relaxed sm:text-[15px]">
                  {typedText}
                  {phase === 'typing' && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-nham-accent align-middle" />
                  )}
                </p>
              </div>
              <p className="mt-1.5 mr-1 text-right text-[10px] text-nham-text-muted opacity-60">
                {t('demo.justNow')}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {isAnalyzing && (
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 self-start text-nham-text-muted text-xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nham-ink">
                    <Sparkles className="h-2.5 w-2.5 animate-pulse text-nham-accent" />
                  </span>
                  <span className="font-medium">
                    {phase === 'matching'
                      ? t('demo.phaseMatching')
                      : t('demo.phaseEstimating')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {showResult && <HeroResultCard fixture={fixture} onSave={onSave} />}
          </div>
        </div>

        {/* Input Bar — real once the canned demo finishes */}
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
            className="flex h-12 items-center justify-between rounded-full border border-nham-border/30 bg-white px-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:h-14 sm:pl-5"
          >
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              disabled={inputDisabled}
              placeholder={t('demo.inputPlaceholder')}
              aria-label={t('demo.inputPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-text-muted/70 disabled:cursor-default sm:text-base"
            />
            <button
              type="submit"
              disabled={inputDisabled}
              aria-label={t('demo.send')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nham-ink shadow-lg transition-transform active:scale-95 disabled:opacity-50 sm:h-10 sm:w-10"
            >
              <ArrowRight className="h-4 w-4 text-white" />
            </button>
          </form>
        </div>

        {/* Gradient Overlay for Bottom Fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#FAF9F7] to-transparent" />
      </div>

      {/* Floating Context Badge — beside the message bubble */}
      {showResult && (
        <motion.div
          initial={
            prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }
          }
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-[38%] left-[calc(100%+1rem)] z-30 hidden w-[170px] -translate-y-1/2 rounded-2xl border border-nham-border/40 bg-white/95 p-3 shadow-xl backdrop-blur-md xl:block"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="font-bold text-[9px] text-nham-text-muted uppercase tracking-wider">
              {t('demo.smartContext')}
            </span>
          </div>
          <p className="font-medium text-[10px] text-nham-text leading-relaxed">
            {t('demo.smartContextText')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
