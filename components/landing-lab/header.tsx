'use client';

import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import type { LabTone } from './command-bar';
import { LAB_COPY } from './copy';

/**
 * Minimal fixed header for the prototypes — wordmark + a visual CTA.
 * The production Header needs AuthProvider; the lab stays decoupled.
 */
export function LabHeader({ tone = 'light' }: { tone?: LabTone }) {
  const dark = tone === 'dark';

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xl ${
        dark
          ? 'border-nham-surface/10 bg-nham-ink/80'
          : 'border-nham-border/30 bg-nham-surface/80'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Real brand wordmark at the same size the docs header uses, rather
            than typing "Kallo" in the body serif. */}
        <KalloWordmark
          className={`h-6 w-auto ${dark ? 'text-nham-surface' : 'text-nham-text'}`}
        />

        <button
          type="button"
          className={`rounded-xl px-4 py-2 font-medium font-sans-display text-sm transition-transform hover:-translate-y-0.5 ${
            dark
              ? 'bg-nham-surface text-nham-text'
              : 'bg-nham-ink text-nham-surface'
          }`}
        >
          {LAB_COPY.cta}
        </button>
      </div>
    </header>
  );
}
