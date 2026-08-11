'use client';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { canonicalProductId } from '@/lib/billing/products';
import type { Package } from '@/lib/billing/web-purchases';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  rcPackage: Package;
  /** Whether this card's purchase is currently in flight. */
  pending: boolean;
  /** Whether any purchase (this or another card) is in flight. */
  anyPending: boolean;
  onSelect: () => void;
}

/**
 * A single offering package in the paywall. Highlights the annual plan (the
 * value pick) with the tan accent border and a "best value" ribbon; lifetime
 * reads as a one-time buy. Prices come live from the RC offering.
 */
export function PackageCard({
  rcPackage,
  pending,
  anyPending,
  onSelect,
}: PackageCardProps) {
  const t = useTranslations('billing.paywall');
  const product = rcPackage.webBillingProduct;
  // Product ids are allowlisted before rendering, so copy follows the product
  // being charged even if a dashboard package label is misconfigured.
  //
  // Resolve through the catalog rather than comparing the raw identifier: a
  // Paddle-backed offering reports opaque `pri_…` ids, which match no canonical
  // name and would silently render every plan — annual and lifetime included —
  // as "Monthly / month" at the price of the real product.
  const canonicalId = canonicalProductId(product.identifier);
  const isAnnual = canonicalId === 'kallo_premium_annual';
  const isLifetime = canonicalId === 'kallo_premium_lifetime';

  const cadence = isLifetime
    ? t('cadenceOnce')
    : isAnnual
      ? t('cadenceYear')
      : t('cadenceMonth');

  const planName = isLifetime
    ? t('planLifetime')
    : isAnnual
      ? t('planAnnual')
      : t('planMonthly');

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={anyPending}
      aria-busy={pending}
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white px-4 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60',
        isAnnual
          ? 'border-nham-accent/70 hover:border-nham-accent'
          : 'border-nham-border/70 hover:border-nham-border'
      )}
    >
      {isAnnual && (
        <span className="absolute -top-2 right-3 rounded-full bg-nham-accent px-2 py-0.5 font-medium text-[10px] text-white uppercase tracking-[0.1em]">
          {t('annualHint')}
        </span>
      )}

      <span className="text-[13px] text-nham-text-muted">{planName}</span>

      <span className="mt-1 flex items-baseline gap-1">
        <span className="font-serif text-2xl text-nham-text">
          {product.price.formattedPrice}
        </span>
        <span className="text-[13px] text-nham-text-muted">{cadence}</span>
      </span>

      <span className="mt-3 inline-flex items-center gap-1.5 font-medium text-[13px] text-nham-text">
        {pending ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check aria-hidden="true" className="h-3.5 w-3.5 text-nham-accent" />
        )}
        {pending ? t('opening') : t('choosePlan')}
      </span>
    </button>
  );
}
