'use client';

import { Moon, Sun } from 'lucide-react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import type { HeroTone } from './tone';

/**
 * The lab's header: wordmark, the light/dark switch, and a Get started that
 * actually opens the auth dialog rather than sitting there as decoration.
 *
 * Separate from `landing-lab/header.tsx` because this one needs AuthProvider
 * above it, and the globe lab has none — mounting this there would throw.
 */
export function HeroHeader({
  tone,
  onToggleTone,
}: {
  tone: HeroTone;
  onToggleTone: () => void;
}) {
  const { openDialog } = useAuthDialog();
  const dark = tone === 'espresso';

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-xl ${
        dark
          ? 'border-white/10 bg-[#1C1810]/80'
          : 'border-nham-border/30 bg-nham-surface/80'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <KalloWordmark
          className={`h-6 w-auto ${dark ? 'text-nham-surface' : 'text-nham-text'}`}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTone}
            aria-label={dark ? 'Switch to light' : 'Switch to dark'}
            aria-pressed={dark}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              dark
                ? 'text-nham-surface/70 hover:bg-white/10 hover:text-nham-surface'
                : 'text-nham-text-muted hover:bg-nham-hover hover:text-nham-text'
            }`}
          >
            {dark ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => openDialog('sign-up')}
            className={`rounded-xl px-4 py-2 font-medium font-sans-display text-sm transition-transform hover:-translate-y-0.5 ${
              dark
                ? 'bg-nham-surface text-nham-text'
                : 'bg-nham-ink text-nham-surface'
            }`}
          >
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}
