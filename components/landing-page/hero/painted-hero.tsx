'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useRef } from 'react';
import { useScrollSettle } from '@/hooks/landing/use-scroll-settle';
import { AppStoreButton } from '../app-store-button';
import { heroStill, landingClip } from '../showcase/media';
import { ProductVideo } from '../showcase/product-video';
import { HeroHeadline } from './headline';
import { HeroStill } from './hero-still';
import { WebSignUpLink } from './web-sign-up-link';

const rise = (step: number) => ({ '--rise-step': step }) as CSSProperties;

/** How much larger than its settled size the film sits at the top of the page. */
const FILM_STARTS_AT = 1.125;

/** The headline over the page's painted canvas, the product rising from it. */
export function PaintedHero() {
  const t = useTranslations('landing.hero');
  const locale = useLocale();
  const filmRef = useRef<HTMLDivElement>(null);

  useScrollSettle(filmRef, FILM_STARTS_AT);

  return (
    <section aria-labelledby="landing-headline" className="relative">
      <div className="mx-auto flex max-w-[86rem] flex-col items-center px-6 pt-32 text-center sm:px-12 sm:pt-36 lg:px-20">
        <div className="animate-rise" style={rise(0)}>
          <HeroHeadline ink="text-kallo-text" />
        </div>
        <p
          style={rise(1)}
          className="mt-5 max-w-2xl animate-rise text-pretty font-medium text-base text-kallo-text leading-[1.4] tracking-[-0.02em] sm:text-[1.1875rem]"
        >
          {t('subtitle')}
        </p>
        <div
          style={rise(2)}
          className="mt-8 flex animate-rise flex-wrap items-center justify-center gap-3"
        >
          <AppStoreButton />
          <WebSignUpLink />
        </div>
        {/* No `animate-rise` here: the film's opening frame is the page's
            largest paint, and a fade would hold it back a second after the
            image has arrived. */}
        <div
          ref={filmRef}
          style={{ '--settle': FILM_STARTS_AT } as CSSProperties}
          className="mt-14 w-full md:w-[80vw] md:max-w-[76rem] md:origin-top md:motion-safe:[transform:scale(var(--settle))]"
        >
          <div className="relative overflow-hidden rounded-[1.25rem] bg-kallo-hover shadow-2xl sm:rounded-[1.75rem]">
            <HeroStill {...heroStill(locale)} />
            <ProductVideo
              clip={landingClip(locale, 'log')}
              width={2400}
              height={1350}
              label={t('videoLabel')}
              poster={false}
              className="relative aspect-[4/5] object-cover md:aspect-video"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
