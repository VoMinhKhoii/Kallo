'use client';

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
          ? 'border-[#FEFBF6]/10 bg-[#2C2416]/80'
          : 'border-[#E8D5B5]/30 bg-[#FEFBF6]/80'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div
          className={`font-medium font-serif text-2xl ${
            dark ? 'text-[#FEFBF6]' : 'text-[#2C2416]'
          }`}
        >
          Nhẩm<span className="text-[#C9A87C]">.</span>
        </div>

        <button
          type="button"
          className={`rounded-xl px-4 py-2 font-medium font-sans-display text-sm transition-transform hover:-translate-y-0.5 ${
            dark ? 'bg-[#C9A87C] text-[#2C2416]' : 'bg-[#2C2416] text-[#FEFBF6]'
          }`}
        >
          {LAB_COPY.cta}
        </button>
      </div>
    </header>
  );
}
