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
 * Caution and tip use conventional red and green rather than the brand's warm
 * terracotta and sage. That is a deliberate, scoped exception to the "no pure
 * red, no pure green" rule, not drift: docs are a reading surface where a
 * warning has to be spotted while skimming, and the warm pair read as muted at
 * this size. It applies to `components/docs/` only — in-product alerts keep
 * terracotta and sage, so please don't "fix" this back.
 *
 * The saturated *label* carries the signal; the tint stays light so a page with
 * several callouts doesn't turn into a traffic light.
 */

type CalloutTone = 'note' | 'caution' | 'tip';

const TONES: Record<CalloutTone, { container: string; label: string }> = {
  // White, not `kallo-track`: the track wash is #f5f4f0 against a #fcfcfc
  // canvas — 1.04:1, so the aside had no visible edge at all.
  note: {
    container: 'border-kallo-border bg-white',
    label: 'text-kallo-text',
  },
  caution: {
    container: 'border-red-200 bg-red-50',
    label: 'text-red-700',
  },
  tip: {
    container: 'border-green-200 bg-green-50',
    label: 'text-green-700',
  },
};

interface CalloutProps {
  /** Sentence-case, already localized — e.g. "Lưu ý" / "Good to know". */
  label: string;
  tone?: CalloutTone;
  children: ReactNode;
}

export function Callout({ label, tone = 'note', children }: CalloutProps) {
  // MDX props are not type-checked at build time, so `tone="warning"` from a
  // content author would otherwise be `undefined` here and take the whole page
  // down on the next property access.
  const styles = TONES[tone] ?? TONES.note;

  return (
    <aside className={cn('mt-6 rounded-xl border p-card-sm', styles.container)}>
      <p
        className={cn(
          'font-sans-display font-semibold text-caption',
          styles.label
        )}
      >
        {label}
      </p>
      <div className="[&>*:first-child]:mt-1">{children}</div>
    </aside>
  );
}
