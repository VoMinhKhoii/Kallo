'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useRef } from 'react';
import { useScrollSettle } from '@/hooks/landing/use-scroll-settle';
import { landingClip } from '../media/media';
import { ProductVideo } from '../media/product-video';
import { MoreLink } from '../section-text/more-link';
import { SectionTitle } from '../section-text/section-title';

const ROWS = [
  { id: 'macros', doc: '/docs/estimates/how-it-works' },
  { id: 'micros', doc: '/docs/tracking/nutrition' },
  { id: 'range', doc: undefined },
] as const;

/** How much larger than its settled size the panel arrives on screen. */
const PANEL_STARTS_AT = 1.08;

/**
 * The film's vitamin wall beside what the nutrition tab actually tracks. From
 * `lg` the text sits on the left and the clip on the right, and the pair eases
 * down to its width as it scrolls in.
 */
export function BeyondMacros() {
  const t = useTranslations('landing.showcase.beyond');
  const locale = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);

  useScrollSettle(panelRef, PANEL_STARTS_AT);

  return (
    <section
      aria-labelledby="landing-beyond"
      className="mx-auto px-6 pt-24 sm:px-12 md:pt-44 lg:w-[84vw] lg:max-w-[78rem] lg:px-0"
    >
      <div
        ref={panelRef}
        style={{ '--settle': PANEL_STARTS_AT } as CSSProperties}
        className="grid items-center gap-10 lg:origin-top lg:grid-cols-[minmax(0,1fr)_42%] lg:gap-[clamp(3rem,7vw,6.5rem)] lg:motion-safe:[transform:scale(var(--settle))]"
      >
        <div className="overflow-hidden rounded-3xl bg-kallo-hover lg:order-last">
          <ProductVideo
            clip={landingClip(locale, 'micro')}
            width={1080}
            height={1350}
            label={t('alt')}
          />
        </div>
        <div>
          <SectionTitle
            id="landing-beyond"
            lead={t('titleLead')}
            rest={t('titleRest')}
            underlined={false}
            className="lg:text-5xl xl:text-6xl"
          />
          <dl className="mt-8 divide-y divide-kallo-text/25">
            {ROWS.map(({ id: row, doc }) => (
              <div key={row} className="py-6 first:pt-0 last:pb-0">
                <dt className="font-sans-display text-[1.75rem] text-kallo-text leading-[1.25] tracking-[-0.018em]">
                  {doc ? (
                    <MoreLink href={doc} text={t(`${row}.title`)} />
                  ) : (
                    t(`${row}.title`)
                  )}
                </dt>
                <dd className="mt-2 text-kallo-text text-lg leading-[1.55]">
                  {t(`${row}.body`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
