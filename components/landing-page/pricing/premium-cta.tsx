'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Premium's buy button: the Flutter paywall's gold pill with ink text.
 *
 * On Yearly the saving rides on the button itself — an ink "Save N%" chip
 * hanging off its top-right edge — so the claim sits on the thing that earns
 * it. Monthly has no saving, so no chip. The percentage is computed from the
 * prices on screen (`premiumDisplay`), never authored: it is 69% in dollars
 * and 24% in đồng, so a hardcoded number would be wrong in one market.
 *
 * Same height and radius as the Free card's ink pill, so the two buttons read
 * as a pair across the subgrid row.
 */
export function PremiumCta({
  label,
  savePercent,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  savePercent: number | null;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const t = useTranslations('landing.pricing');

  return (
    <div className="relative">
      {savePercent !== null && (
        <span
          data-testid="pricing-save-chip"
          className="pointer-events-none absolute -top-3 right-3 z-10 whitespace-nowrap rounded-full bg-kallo-ink px-2.5 py-1 font-medium font-sans-display text-kallo-gold text-xs"
        >
          {t('discount', { percent: savePercent })}
        </span>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy}
        data-testid="pricing-premium-cta"
        className="relative flex h-12 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-kallo-gold-edge bg-gradient-to-br from-kallo-gold-light via-kallo-gold to-kallo-gold-deep font-sans-display font-semibold text-base text-kallo-text tracking-[-0.2px] shadow-kallo-gold-deep/30 shadow-lg transition-[filter,opacity] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-gold-edge focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {/* The sheen: a soft diagonal highlight across the fill. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-115 from-35% from-transparent via-50% via-white/45 to-62% to-transparent"
        />
        {busy && (
          <Loader2 aria-hidden className="relative h-4 w-4 animate-spin" />
        )}
        <span className="relative">{label}</span>
      </button>
    </div>
  );
}
