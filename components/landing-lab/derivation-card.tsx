'use client';

import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LabTone } from './command-bar';
import { LAB_COPY } from './copy';
import type { LabDemo } from './use-demo';

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
  const mutedText = tone === 'dark' ? 'text-[#B8A88E]' : 'text-[#8B7355]';

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
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416]">
                <Sparkles className="h-2.5 w-2.5 animate-pulse text-[#C9A87C]" />
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
          <div className="rounded-2xl border border-[#E8D5B5]/60 bg-white p-5 text-left shadow-[0_20px_50px_-20px_rgba(44,36,22,0.18)]">
            <div className="mb-3 flex items-center justify-between border-[#F0EAE0] border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416]">
                  <Sparkles className="h-2.5 w-2.5 text-[#C9A87C]" />
                </span>
                <span className="font-bold text-[#8B7355] text-[10px] uppercase tracking-[0.2em]">
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
                  <span className="truncate text-[#6B5D4F]">{row.name}</span>
                  <span className="shrink-0 font-mono font-semibold text-[#2C2416] tabular-nums">
                    {row.cal}
                  </span>
                </motion.div>
              ))}

              <div className="mt-1 flex items-baseline justify-between border-[#F0EAE0] border-t pt-3">
                <span className="font-serif text-[#2C2416] text-sm">
                  {LAB_COPY.demo.total}
                </span>
                <span className="font-mono font-semibold text-[#A9834E] text-lg tabular-nums">
                  {demo.fixture.totalRange}
                  <span className="ml-1 font-sans text-[#8B7355] text-xs">
                    {LAB_COPY.demo.unit}
                  </span>
                </span>
              </div>

              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2C2416] py-2.5 font-medium text-[#FEFBF6] text-xs transition-transform active:scale-[0.98]"
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
