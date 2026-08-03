import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * An aside inside docs prose.
 *
 * Label-driven rather than icon-driven on purpose: the brand's icon allowance
 * is deliberately small, and the drift watchlist calls out pill + icon +
 * coloured-state combos as an anti-pattern. The label is sentence case (not an
 * eyebrow) so long-form pages don't accumulate uppercase noise, and the label
 * text comes from MDX so it is already in the page's language.
 *
 * Colours stay warm: terracotta for a caution, sage for a tip, the neutral
 * track wash for a plain note. No pure red, no pure green.
 */

type CalloutTone = 'note' | 'caution' | 'tip';

const TONES: Record<CalloutTone, { container: string; label: string }> = {
  note: {
    container: 'border-nham-border bg-nham-track',
    label: 'text-nham-text',
  },
  caution: {
    container: 'border-nham-danger/30 bg-nham-danger/8',
    label: 'text-nham-danger',
  },
  tip: {
    container: 'border-nham-success-border bg-nham-success-faint',
    label: 'text-nham-success-dark',
  },
};

interface CalloutProps {
  /** Sentence-case, already localized — e.g. "Lưu ý" / "Good to know". */
  label: string;
  tone?: CalloutTone;
  children: ReactNode;
}

export function Callout({ label, tone = 'note', children }: CalloutProps) {
  const styles = TONES[tone];

  return (
    <aside className={cn('mt-6 rounded-xl border p-card-sm', styles.container)}>
      <p
        className={cn(
          'font-sans-display font-semibold text-[13px]',
          styles.label
        )}
      >
        {label}
      </p>
      <div className="[&>*:first-child]:mt-1 [&>p]:text-[15px]">{children}</div>
    </aside>
  );
}
