'use client';

import { useTranslations } from 'next-intl';
import { WaitlistPill } from '../hero/waitlist-pill';
import { SectionTitle } from '../section-text/section-title';

/** The last screen before the footer: one sentence and the waitlist. */
export function DownloadClose() {
  const t = useTranslations('landing.showcase.close');

  return (
    <section
      aria-labelledby="landing-close"
      className="px-6 py-24 text-center sm:px-12 md:py-44 lg:px-20"
    >
      <SectionTitle id="landing-close" lead={t('line')} rest={t('sub')} />
      <div className="mt-10">
        <WaitlistPill source="cta" />
      </div>
    </section>
  );
}
