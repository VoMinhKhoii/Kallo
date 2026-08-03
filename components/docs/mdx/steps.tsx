import type { ReactNode } from 'react';

/**
 * A numbered walkthrough.
 *
 * The rail is a hairline with mono numerals sitting on it — the same
 * "typography, not chrome" move the rest of the product uses. Numbers are
 * `tabular-nums` so a list that reaches double digits doesn't shift.
 *
 * Rendered as a real `<ol>` so screen readers announce the count and the
 * position; the visible numerals are decorative and hidden from them.
 */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-6 space-y-0">{children}</ol>;
}

interface StepProps {
  /** 1-based position, written explicitly in MDX so the source reads clearly. */
  index: number;
  title: string;
  children: ReactNode;
}

export function Step({ index, title, children }: StepProps) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {/* Connector: stops at the last step so the rail doesn't dangle. */}
      <span
        aria-hidden="true"
        className="absolute top-7 bottom-0 left-[13px] w-px bg-nham-border"
      />
      <span
        aria-hidden="true"
        className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-nham-border bg-white font-mono text-[11px] text-nham-text-muted tabular-nums"
      >
        {index}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-sans-display font-semibold text-[15px] text-nham-text">
          {title}
        </p>
        <div className="[&>*:first-child]:mt-1.5">{children}</div>
      </div>
    </li>
  );
}
