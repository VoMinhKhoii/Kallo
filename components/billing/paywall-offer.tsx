import { Check, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { Package } from '@/lib/billing/web-purchases';
import { cn } from '@/lib/utils';
import { PackageCard } from './package-card';

interface PaywallOfferProps {
  trialActive: boolean;
  daysRemaining: number;
  packages: Package[];
  pendingId: string | null;
  purchasing: boolean;
  offeringsPending: boolean;
  offeringsFailed: boolean;
  onSelect: (rcPackage: Package) => void;
}

export function PaywallOffer({
  trialActive,
  daysRemaining,
  packages,
  pendingId,
  purchasing,
  offeringsPending,
  offeringsFailed,
  onSelect,
}: PaywallOfferProps) {
  const t = useTranslations('billing.paywall');
  const perks = [t('perk1'), t('perk2'), t('perk3')];

  return (
    <div className="flex flex-col px-6 pt-6 pb-6">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-nham-accent uppercase tracking-[0.14em]">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t('eyebrow')}
        </span>
        <DialogTitle className="mt-2 font-normal font-serif text-2xl text-nham-text leading-snug">
          {t('titleLead')}{' '}
          <span className="text-nham-accent italic [font-weight:300]">
            {t('titleAccent')}
          </span>
        </DialogTitle>
        <DialogDescription className="mt-2 text-[14px] text-nham-text-soft leading-relaxed">
          {t('subtitle')}
        </DialogDescription>
      </header>

      {trialActive && (
        <p className="mt-3 rounded-xl bg-nham-hover/50 px-3.5 py-2.5 text-[13px] text-nham-text-soft">
          {t('trialCountdown', { days: daysRemaining })}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {perks.map((perk) => (
          <li
            key={perk}
            className="flex items-start gap-2 text-[14px] text-nham-text"
          >
            <Check
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-nham-accent"
            />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {offeringsFailed ? (
          <p className="rounded-xl border border-nham-border/70 bg-white px-4 py-4 text-center text-[13.5px] text-nham-text-muted">
            {t('unavailable')}
          </p>
        ) : offeringsPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : packages.length === 0 ? (
          <p className="rounded-xl border border-nham-border/70 bg-white px-4 py-4 text-center text-[13.5px] text-nham-text-muted">
            {t('unavailable')}
          </p>
        ) : (
          <div
            className={cn(
              'grid gap-3',
              packages.length > 1 && 'sm:grid-cols-2'
            )}
          >
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.identifier}
                rcPackage={pkg}
                pending={pendingId === pkg.identifier}
                anyPending={purchasing}
                onSelect={() => onSelect(pkg)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[12px] text-nham-text-muted">
        {t('finetext')}
      </p>
    </div>
  );
}
