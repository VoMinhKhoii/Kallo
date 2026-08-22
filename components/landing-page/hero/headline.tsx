'use client';

import { useTranslations } from 'next-intl';

/**
 * The clause split exists so the verb can be underlined without dragging the
 * punctuation under the rule with it. Commas and full stops are the same in
 * both locales, so they stay in code rather than becoming translatable noise.
 */
const CLAUSES = [
  { key: 'clause1', tail: ',' },
  { key: 'clause2', tail: '.' },
] as const;

/**
 * "You describe, / we derive."
 *
 * Both clauses sit in the same ink — no italic, no accent colour. The two verbs
 * carry an underline instead, which is what the promise actually turns on: what
 * you do, and what the app does back.
 */
export function HeroHeadline({
  ink,
  className = '',
}: {
  ink: string;
  className?: string;
}) {
  const t = useTranslations('landing.hero.headline');

  return (
    <h1
      className={`font-medium font-serif text-[clamp(3.25rem,6.6vw,5rem)] leading-[1.04] tracking-[-0.03em] ${ink} ${className}`}
    >
      {CLAUSES.map((clause, index) => (
        <span key={clause.key} className="block">
          {t(`${clause.key}.lead`)}{' '}
          <span className="underline decoration-[0.055em] underline-offset-[0.16em]">
            {t(`${clause.key}.word`)}
          </span>
          {clause.tail}
          {/* The clauses are separate blocks; without this a screen reader runs
              them together as one word. */}
          {index === 0 ? <span className="sr-only"> </span> : null}
        </span>
      ))}
    </h1>
  );
}
