import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface PaywallStatusProps {
  activationPending: boolean;
  checkingActivation: boolean;
  onAction: () => void;
}

export function PaywallStatus({
  activationPending,
  checkingActivation,
  onAction,
}: PaywallStatusProps) {
  const t = useTranslations('billing.paywall');

  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nham-success/15">
        <Check aria-hidden="true" className="h-6 w-6 text-nham-success" />
      </span>
      <DialogTitle className="mt-4 font-normal font-serif text-nham-text text-xl">
        {activationPending ? t('pendingTitle') : t('successTitle')}
      </DialogTitle>
      <DialogDescription className="mt-1.5 text-[14px] text-nham-text-soft">
        {activationPending ? t('pendingBody') : t('successBody')}
      </DialogDescription>
      <button
        type="button"
        onClick={onAction}
        disabled={checkingActivation}
        aria-busy={checkingActivation}
        className="mt-6 rounded-xl bg-nham-ink px-5 py-2.5 font-medium text-[14px] text-nham-surface transition-colors hover:bg-nham-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent disabled:opacity-60"
      >
        {activationPending ? t('pendingCta') : t('successCta')}
      </button>
    </div>
  );
}
