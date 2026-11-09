'use client';

import { useTranslations } from 'next-intl';
import { AppStoreButton } from '../app-store-button';
import { SectionTitle } from './section-title';

/** The last screen before the footer: one sentence and the button. */
export function DownloadClose() {
  const t = useTranslations('landing.showcase.close');

  return (
    <section
      aria-labelledby="landing-close"
      className="px-6 py-24 text-center sm:px-12 md:py-44 lg:px-20"
    >
      <SectionTitle id="landing-close" lead={t('line')} rest={t('sub')} />
      <AppStoreButton className="mt-10" />
    </section>
  );
}
