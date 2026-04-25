'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function EmptyState() {
  const t = useTranslations('nutrition');

  return (
    <section className="rounded-3xl border border-nham-border/60 bg-card p-6">
      <h2 className="font-semibold text-lg text-nham-text">
        {t('empty.title')}
      </h2>
      <p className="mt-2 max-w-2xl text-nham-text-muted text-sm leading-6">
        {t('empty.description')}
      </p>
      <Link
        href="/logging"
        className="mt-4 inline-flex touch-manipulation items-center rounded-xl bg-nham-btn px-4 py-2 font-medium text-card text-sm transition-colors hover:bg-nham-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent focus-visible:ring-offset-2 focus-visible:ring-offset-nham-surface"
      >
        {t('empty.logMeal')}
      </Link>
    </section>
  );
}
