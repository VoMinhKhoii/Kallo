'use client';

import { ExternalLink } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import {
  DANGER_BUTTON,
  SECONDARY_BUTTON,
} from '@/components/settings/chrome/controls';
import { SettingsGroup, SettingsRow } from '@/components/settings/chrome/group';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-medium text-[15px] text-kallo-text">{title}</h3>
      <SettingsGroup>{children}</SettingsGroup>
    </section>
  );
}

function PortalLink({
  href,
  danger,
  children,
}: {
  href: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={danger ? DANGER_BUTTON : SECONDARY_BUTTON}
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
    </a>
  );
}

/**
 * Payment, Invoices and Cancellation under a paid plan, in the outline of
 * Claude's billing page. Kallo holds no card or invoice data itself: every
 * row opens the store's own page (Paddle's customer portal on the web, the
 * App Store or Google Play), which is where those live. Apple and Google
 * send their own receipts, so Invoices shows for web plans only;
 * Cancellation hides once the plan is already set to end.
 */
export function BillingSections({
  manageUrl,
  store,
  willRenew,
  renewalDate,
  t,
}: {
  manageUrl: string;
  store: string | null;
  willRenew: boolean;
  renewalDate: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const web = store !== 'app_store' && store !== 'play_store';
  const payment =
    store === 'app_store'
      ? t('billing.paymentAppStore')
      : store === 'play_store'
        ? t('billing.paymentPlayStore')
        : t('billing.paymentWeb');

  return (
    <div className="mt-8 flex flex-col gap-8">
      <Section title={t('billing.paymentTitle')}>
        <SettingsRow label={payment}>
          <PortalLink href={manageUrl}>{t('billing.update')}</PortalLink>
        </SettingsRow>
      </Section>
      {web && (
        <Section title={t('billing.invoicesTitle')}>
          <SettingsRow label={t('billing.invoicesLabel')}>
            <PortalLink href={manageUrl}>{t('billing.view')}</PortalLink>
          </SettingsRow>
        </Section>
      )}
      {willRenew && (
        <Section title={t('billing.cancelTitle')}>
          <SettingsRow
            label={t('billing.cancelLabel')}
            description={
              renewalDate
                ? t('billing.cancelHint', { date: renewalDate })
                : undefined
            }
          >
            <PortalLink href={manageUrl} danger>
              {t('billing.cancel')}
            </PortalLink>
          </SettingsRow>
        </Section>
      )}
    </div>
  );
}
