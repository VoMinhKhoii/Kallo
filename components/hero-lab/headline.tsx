import { HERO_COPY } from './copy';

/**
 * "You describe, / we derive."
 *
 * Both clauses sit in the same ink — no italic, no accent colour. The two
 * verbs carry an underline instead, which is what the promise actually turns
 * on: what you do, and what the app does back. Punctuation stays outside the
 * rule so the line doesn't read as a form field.
 */
export function HeroHeadline({
  ink,
  className = '',
}: {
  ink: string;
  className?: string;
}) {
  return (
    <h1
      className={`font-medium font-serif text-[clamp(2.75rem,6.6vw,5rem)] leading-[1.04] tracking-[-0.03em] ${ink} ${className}`}
    >
      {HERO_COPY.headline.map((line, index) => (
        <span key={line.word} className="block">
          {line.lead}{' '}
          <span className="underline decoration-[0.055em] underline-offset-[0.16em]">
            {line.word}
          </span>
          {line.tail}
          {index === 0 ? <span className="sr-only"> </span> : null}
        </span>
      ))}
    </h1>
  );
}
