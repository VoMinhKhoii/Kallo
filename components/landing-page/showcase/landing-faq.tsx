'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { SectionTitle } from '../section-text/section-title';

const QUESTIONS = ['numbers', 'weigh', 'web'] as const;

const ROW = 'group border-kallo-text/25 border-t py-6 first:border-t-0';
const QUESTION =
  'flex cursor-pointer list-none items-center justify-between gap-6 font-medium font-sans-display text-kallo-text text-2xl leading-[1.2] tracking-[-0.03em] [&::-webkit-details-marker]:hidden';
const CHEVRON =
  'size-5 shrink-0 text-kallo-text-muted transition-transform group-open:rotate-180';
const ANSWER = 'mt-3 max-w-3xl text-kallo-text text-lg leading-[1.55]';

export function LandingFaq() {
  const t = useTranslations('landing.showcase.faq');

  return (
    <section
      aria-labelledby="landing-faq"
      className="mx-auto max-w-[86rem] px-6 pt-24 sm:px-12 md:pt-44 lg:px-20"
    >
      <SectionTitle id="landing-faq" lead={t('title')} className="mb-10" />
      <div>
        {QUESTIONS.map((question) => (
          <details key={question} className={ROW}>
            <summary className={QUESTION}>
              {t(`${question}.q`)}
              <ChevronDown aria-hidden="true" className={CHEVRON} />
            </summary>
            <p className={ANSWER}>{t(`${question}.a`)}</p>
          </details>
        ))}
        <details className={ROW}>
          <summary className={QUESTION}>
            {t('cost.q')}
            <ChevronDown aria-hidden="true" className={CHEVRON} />
          </summary>
          <p className={ANSWER}>
            {t.rich('cost.a', {
              link: (chunks) => (
                <Link href="/pricing" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </details>
      </div>
    </section>
  );
}
