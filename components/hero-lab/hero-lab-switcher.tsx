'use client';

import { useState } from 'react';
import { LabHeader } from '@/components/landing-lab/header';
import { ChromaticField } from './chromatic-field';
import { HeroShell } from './hero-shell';
import { MealCardHero } from './meal-card-hero';
import { GROUND } from './plates';

type Composition = 'cards' | 'calm';
type Tone = 'cream' | 'espresso';

const COMPOSITIONS: { value: Composition; label: string }[] = [
  { value: 'cards', label: 'Meal cards' },
  { value: 'calm', label: 'Calm ground' },
];

const TONES: { value: Tone; label: string }[] = [
  { value: 'cream', label: 'Cream' },
  { value: 'espresso', label: 'Espresso' },
];

/**
 * Every hero direction on one page, behind a switch.
 *
 * Comparing designs across four routes means reloading between each one and
 * judging from memory. Here the copy, the scroll position and the viewport all
 * stay put, and only the thing under test changes — which is the only way to
 * see the difference between two designs rather than remember it.
 */
export function HeroLabSwitcher() {
  const [composition, setComposition] = useState<Composition>('cards');
  const [tone, setTone] = useState<Tone>('cream');
  const dark = tone === 'espresso';

  return (
    <div className={dark ? 'bg-[#1C1810]' : 'bg-nham-surface'}>
      <LabHeader tone={dark ? 'dark' : 'light'} />

      <main>
        {composition === 'cards' ? (
          <MealCardHero key={tone} tone={tone} insetBottom />
        ) : (
          <HeroShell
            key={tone}
            tone={tone}
            insetBottom
            background={() => (
              <ChromaticField
                tone={tone}
                plate={dark ? GROUND.charcoal : GROUND.gouache}
              />
            )}
          />
        )}
      </main>

      {/* Fixed, so blur is safe here and nowhere else on the page. */}
      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full bg-nham-ink/85 p-1.5 shadow-[0_20px_50px_-20px_rgba(20,17,12,0.7)] ring-1 ring-white/10 backdrop-blur-xl">
          <Segment
            options={COMPOSITIONS}
            value={composition}
            onChange={setComposition}
          />
          <span className="mx-1 h-5 w-px bg-white/15" />
          <Segment options={TONES} value={tone} onChange={setTone} />
        </div>
      </div>
    </div>
  );
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`rounded-full px-3.5 py-1.5 font-medium text-xs transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            value === option.value
              ? 'bg-nham-surface text-nham-text'
              : 'text-nham-surface/65 hover:text-nham-surface'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
