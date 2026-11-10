'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useRef } from 'react';
import { useScrollSettle } from '@/hooks/landing/use-scroll-settle';
import { landingClip } from '../media/media';
import { ProductVideo } from '../media/product-video';
import { CardCaption } from '../section-text/card-caption';
import { SectionTitle } from '../section-text/section-title';

/** Label scanning has no docs page of its own yet, so its caption stays plain. */
const WAYS = [
  { id: 'barcode', doc: '/docs/logging/barcode' },
  { id: 'relog', doc: '/docs/logging/relog' },
  { id: 'label', doc: undefined },
] as const;

/** How much larger than its settled size the row arrives on screen. */
const ROW_STARTS_AT = 1.08;

/**
 * Three ways to log without writing a sentence, each a real clip of the app.
 * From `md` the title sits on the left, and the row eases down to its width as
 * it scrolls in.
 */
export function TypingAlternatives() {
  const t = useTranslations('landing.showcase.typing');
  const locale = useLocale();
  const rowRef = useRef<HTMLUListElement>(null);

  useScrollSettle(rowRef, ROW_STARTS_AT);

  return (
    <section
      aria-labelledby="landing-typing"
      className="mx-auto px-6 pt-24 sm:px-12 md:w-[84vw] md:max-w-[78rem] md:px-0 md:pt-44"
    >
      <SectionTitle
        id="landing-typing"
        lead={t('titleLead')}
        rest={t('titleRest')}
        oneLine
        className="text-center md:text-left"
      />
      <ul
        ref={rowRef}
        style={{ '--settle': ROW_STARTS_AT } as CSSProperties}
        className="mt-12 grid gap-10 md:mt-16 md:origin-top md:grid-cols-3 md:gap-4 md:motion-safe:[transform:scale(var(--settle))]"
      >
        {WAYS.map(({ id: way, doc }) => (
          <li key={way}>
            <div className="overflow-hidden rounded-3xl bg-kallo-hover">
              <ProductVideo
                clip={landingClip(locale, way)}
                width={1080}
                height={1350}
                label={t(`${way}.alt`)}
              />
            </div>
            <CardCaption
              lead={t(`${way}.lead`)}
              rest={t(`${way}.rest`)}
              href={doc}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
