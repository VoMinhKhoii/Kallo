'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { LAB_COPY } from './copy';
import { getLabFixture, LAB_CHIP_IDS } from './fixtures';
import type { LabDemo } from './use-demo';

export type LabTone = 'light' | 'dark';

/**
 * The centered "product as a sentence" input every variant shares.
 * During autoplay it displays the typed text; once interactive it is a
 * real form driving the same canned derivation.
 */
export function CommandBar({ demo }: { demo: LabDemo }) {
  const busy = demo.isAnalyzing || demo.phase === 'typing';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        demo.submitText(demo.inputValue);
      }}
      className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 rounded-full border border-nham-border bg-white py-2 pr-2 pl-5 shadow-[0_20px_50px_-20px_rgba(105,94,78,0.35)] transition-colors focus-within:border-nham-accent focus-within:ring-[3px] focus-within:ring-nham-accent/25 sm:h-16 sm:pl-6"
    >
      <Sparkles
        aria-hidden
        className={`h-[18px] w-[18px] shrink-0 text-nham-accent ${busy ? 'animate-pulse' : ''}`}
      />

      {demo.interactive ? (
        <input
          value={demo.inputValue}
          onChange={(event) => demo.setInputValue(event.target.value)}
          disabled={busy}
          placeholder={LAB_COPY.demo.placeholder}
          aria-label={LAB_COPY.demo.placeholder}
          className="min-w-0 flex-1 bg-transparent text-base text-nham-text outline-none placeholder:text-[#B0A695] disabled:cursor-default sm:text-lg"
        />
      ) : (
        <div className="min-w-0 flex-1 truncate text-left font-serif text-base text-nham-text sm:text-lg">
          {demo.typedText}
          {demo.phase === 'typing' && (
            <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-nham-accent align-middle" />
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!demo.interactive || busy}
        aria-label={LAB_COPY.demo.send}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-nham-btn shadow-lg transition-[transform,background-color] hover:bg-nham-btn-hover active:scale-95 disabled:opacity-60 sm:h-11 sm:w-11"
      >
        <ArrowRight className="h-4 w-4 text-nham-surface" />
      </button>
    </form>
  );
}

/** Suggestion chips, revealed once the autoplay hands the bar over. */
export function DemoChips({
  demo,
  tone = 'light',
}: {
  demo: LabDemo;
  tone?: LabTone;
}) {
  if (!demo.interactive) {
    return null;
  }
  const busy = demo.isAnalyzing || demo.phase === 'typing';
  const chipClass =
    tone === 'dark'
      ? 'border-nham-surface/15 bg-nham-surface/5 text-[#B8A88E] hover:border-nham-accent/60 hover:text-nham-surface'
      : 'border-nham-border/70 bg-white/80 text-nham-text-muted hover:border-nham-accent hover:text-nham-text';

  return (
    <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2">
      <span
        className={`text-xs ${tone === 'dark' ? 'text-[#B8A88E]/70' : 'text-nham-text-muted/80'}`}
      >
        {LAB_COPY.demo.tryAnother}
      </span>
      {LAB_CHIP_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => demo.selectChip(id)}
          disabled={busy}
          className={`rounded-full border px-3 py-1.5 font-medium text-xs backdrop-blur-sm transition-colors disabled:opacity-50 ${chipClass}`}
        >
          {getLabFixture(id).chipLabel}
        </button>
      ))}
    </div>
  );
}
