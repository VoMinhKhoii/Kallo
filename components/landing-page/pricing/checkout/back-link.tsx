'use client';

import { ArrowLeft } from 'lucide-react';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { usePricingRequest } from './request-context';

/**
 * "Back" to the page that sent the visitor here (`?from=`), or nothing when
 * they arrived some other way. A plain Next link: `from` already carries its
 * locale prefix, which the locale-aware `Link` would add a second time.
 */
export function PricingBackLink() {
  const t = useTranslations('common');
  const from = usePricingRequest().visitor?.from;
  if (!from) return null;

  return (
    <div className="mx-auto w-full max-w-[54rem] px-6 pt-6 sm:px-12 md:px-0">
      <NextLink
        href={from}
        className="inline-flex items-center gap-1.5 font-sans-display text-kallo-text-soft text-sm transition-colors hover:text-kallo-text"
        data-testid="pricing-back-link"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('back')}
      </NextLink>
    </div>
  );
}
