'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { HeroHeader } from './hero-header';
import { MealCardHero } from './meal-card-hero';
import { HERO_TONE, type HeroTone } from './tone';

/**
 * The hero lab page.
 *
 * One composition — the meal cards — on two grounds, switched by the sun/moon
 * in the header, so the copy, scroll position and viewport all stay put while
 * only the ground changes.
 *
 * `footer` arrives as a prop because the real Footer is a server component and
 * this shell is a client one; the page passes it down rather than the footer
 * being forked into a client copy.
 */
export function HeroLabSwitcher({ footer }: { footer: ReactNode }) {
  const [tone, setTone] = useState<HeroTone>('cream');
  const dark = tone === 'espresso';

  return (
    <AuthProvider>
      <div className={HERO_TONE[tone].ground}>
        <HeroHeader
          tone={tone}
          onToggleTone={() => setTone(dark ? 'cream' : 'espresso')}
        />

        <main>
          <MealCardHero key={tone} tone={tone} />
        </main>

        {footer}
      </div>
      <AuthDialog />
    </AuthProvider>
  );
}
