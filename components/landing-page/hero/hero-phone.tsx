'use client';

import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { HeroContextBadge } from '@/components/landing-page/hero/hero-context-badge';
import { HeroInputBar } from '@/components/landing-page/hero/hero-input-bar';
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
  const { fixture, phase, typedText, interactive, isAnalyzing, showResult } =
    demo;
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
        <HeroInputBar demo={demo} disabled={inputDisabled} />

        {/* Gradient Overlay for Bottom Fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[#FAF9F7] to-transparent" />
      </div>

      {/* Floating Context Badge — beside the message bubble */}
      {showResult && <HeroContextBadge />}
    </div>
  );
}
