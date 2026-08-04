'use client';

import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LabDemo } from '@/hooks/landing-lab/use-demo';
import type { LabTone } from './command-bar';
import { LAB_COPY } from './copy';

/**
 * The staged status line + expanding result card under the command bar.
 * The wrapper reserves height so the hero never reflows when the card
 * appears (CLS guard).
 */
export function DerivationCard({
  demo,
  tone = 'light',
}: {
  demo: LabDemo;
  tone?: LabTone;
}) {
  const dark = tone === 'dark';
  const mutedText = dark ? 'text-[#B8A88E]' : 'text-nham-text-muted';
  const cardShell = dark
    ? 'border-white/10 bg-[#241E15] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]'
    : 'border-nham-border/60 bg-white shadow-[0_20px_50px_-20px_rgba(44,36,22,0.18)]';
  const hairline = dark ? 'border-white/10' : 'border-nham-hover';
  const rowText = dark ? 'text-[#D6C9B4]' : 'text-nham-text-soft';
  const strongText = dark ? 'text-nham-surface' : 'text-nham-text';

  return (
    <div className="mx-auto flex min-h-[300px] w-full max-w-xl flex-col items-center gap-4">
      {/* Staged loading copy — announced politely to screen readers. */}
      <div aria-live="polite" className="min-h-6">
        <AnimatePresence mode="wait">
          {demo.isAnalyzing && (
            <motion.div
              key={demo.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-2 text-xs ${mutedText}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nham-ink">
                <Sparkles className="h-2.5 w-2.5 animate-pulse text-nham-accent" />
              </span>
              <span className="font-medium">
                {demo.phase === 'matching'
                  ? LAB_COPY.demo.phaseMatching
                  : LAB_COPY.demo.phaseEstimating}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {demo.showResult && (
        <motion.div
          key={demo.fixture.id + demo.fixture.text}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            demo.prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 300, damping: 30 }
          }
          className="w-full"
        >
          <div className={`rounded-2xl border p-5 text-left ${cardShell}`}>
            <div
              className={`mb-3 flex items-center justify-between border-b pb-3 ${hairline}`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-nham-ink">
                  <Sparkles className="h-2.5 w-2.5 text-nham-accent" />
                </span>
                <span className="font-bold text-[10px] text-nham-text-muted uppercase tracking-[0.2em]">
                  {LAB_COPY.demo.analysis}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {demo.fixture.rows.map((row, index) => (
                <motion.div
                  key={row.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    demo.prefersReducedMotion
                      ? { duration: 0 }
                      : { delay: index * 0.08 }
                  }
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className={`min-w-0 truncate ${rowText}`}>
                    {row.name}
                  </span>
                  <span
                    className={`shrink-0 font-mono font-semibold tabular-nums ${strongText}`}
                  >
                    {row.cal}
                  </span>
                </motion.div>
              ))}

              <div
                className={`mt-1 flex items-baseline justify-between border-t pt-3 ${hairline}`}
              >
                <span className={`font-serif text-sm ${strongText}`}>
                  {LAB_COPY.demo.total}
                </span>
                <span
                  className={`font-mono font-semibold text-lg tabular-nums ${
                    dark ? 'text-nham-accent' : 'text-[#A9834E]'
                  }`}
                >
                  {demo.fixture.totalRange}
                  <span className="ml-1 font-sans text-nham-text-muted text-xs">
                    {LAB_COPY.demo.unit}
                  </span>
                </span>
              </div>

              <button
                type="button"
                className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 font-medium text-xs transition-transform active:scale-[0.98] ${
                  dark
                    ? 'bg-nham-accent text-[#1C1810]'
                    : 'bg-nham-ink text-nham-surface'
                }`}
              >
                {LAB_COPY.demo.save}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
