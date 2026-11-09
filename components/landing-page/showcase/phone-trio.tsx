'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useRef } from 'react';
import { useScrollFrame } from '@/hooks/landing/use-scroll-frame';
import { CardCaption } from './card-caption';
import { appScreen } from './media';
import { SectionTitle } from './section-title';

const PHONES = [
  { id: 'circle', screen: 'circle', drop: '8rem' },
  { id: 'home', screen: 'home', drop: '0rem' },
  { id: 'nutrition', screen: 'nutrition', drop: '8rem' },
] as const;

/** Where the row's top sits, as a share of the viewport, when the rise runs. */
const RISE_STARTS = 0.75;
const RISE_ENDS = -0.25;

/** The share of the pinned scroll spent resting on the first and last phone. */
const SLIDE_HOLD = 0.08;

const unit = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The first-tab tour: Circle, Home, Micronutrients, as they really look.
 * On wider screens the two outer phones start lower than Home and rise level
 * with it as the page scrolls. On a phone the row pins to the screen and
 * scrolling down slides it sideways, one phone to the next. With reduced motion
 * it stays a plain row to swipe.
 */
export function PhoneTrio() {
  const t = useTranslations('landing.showcase.phones');
  const locale = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);

  useScrollFrame(() => {
    const row = rowRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (
      !row ||
      !track ||
      !stage ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const top = row.getBoundingClientRect().top / window.innerHeight;
    const remaining = (top - RISE_ENDS) / (RISE_STARTS - RISE_ENDS);
    row.style.setProperty('--phone-rise', String(unit(remaining)));

    // Zero from `md`, where the track is only as tall as its row.
    const run = track.offsetHeight - stage.offsetHeight;
    if (run > 0) {
      const scrolled = -track.getBoundingClientRect().top / run;
      const slide = (scrolled - SLIDE_HOLD) / (1 - 2 * SLIDE_HOLD);
      track.style.setProperty('--phone-slide', String(unit(slide)));
    }
  });

  return (
    <section
      id="features"
      aria-labelledby="landing-phones"
      className="scroll-mt-20 pt-24 md:pt-44"
    >
      <SectionTitle
        id="landing-phones"
        lead={t('titleLead')}
        rest={t('titleRest')}
        oneLine
        className="mx-auto max-w-[86rem] px-6 text-center sm:px-12 lg:px-20"
      />
      {/* `--slide-card` and `--slide-gap` match the `li` width and the row's
          `gap-6`, so the distance to the last phone is known in CSS and the
          track has its real height in the server's HTML. */}
      <div
        ref={trackRef}
        style={
          {
            '--slide-card': 'min(72vw, 20rem)',
            '--slide-gap': '1.5rem',
            '--slide-travel':
              'calc(2 * (var(--slide-card) + var(--slide-gap)))',
          } as CSSProperties
        }
        className="max-md:motion-safe:h-[calc(100svh+var(--slide-travel)*1.5)]"
      >
        <div
          ref={stageRef}
          className="max-md:motion-safe:sticky max-md:motion-safe:top-0 max-md:motion-safe:flex max-md:motion-safe:h-svh max-md:motion-safe:items-center max-md:motion-safe:overflow-hidden max-md:motion-safe:pt-20"
        >
          <ul
            ref={rowRef}
            className="mx-auto mt-12 flex max-w-[86rem] snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 max-md:motion-safe:mx-0 max-md:motion-safe:mt-0 max-md:motion-safe:w-max max-md:motion-safe:max-w-none max-md:motion-safe:overflow-visible max-md:motion-safe:px-[calc((100vw-var(--slide-card))/2)] max-md:motion-safe:pb-0 md:mt-20 md:snap-none md:justify-center md:gap-[clamp(2rem,5vw,4.5rem)] md:overflow-visible md:px-12 md:pb-0 lg:px-20 max-md:motion-safe:[transform:translate3d(calc(var(--phone-slide,0)*var(--slide-travel)*-1),0,0)]"
          >
            {PHONES.map((phone) => (
              <li
                key={phone.id}
                style={{ '--drop': phone.drop } as CSSProperties}
                className="w-[72vw] max-w-[20rem] shrink-0 snap-center max-md:motion-safe:text-center md:w-[clamp(14rem,22vw,20rem)] md:[transform:translate3d(0,calc(var(--phone-rise,0)*var(--drop)),0)]"
              >
                {/* Height-bound while pinned, so a short screen still fits the
                    phone and its caption under the header. */}
                <div className="overflow-hidden rounded-[15.4%/7.1%] bg-[#0b0b0a] p-[2.9%] max-md:motion-safe:mx-auto max-md:motion-safe:w-[min(100%,calc((100svh-14rem)*0.46))]">
                  <Image
                    src={appScreen(locale, phone.screen)}
                    alt={t(`${phone.id}.alt`)}
                    width={660}
                    height={1434}
                    sizes="(max-width: 767px) 72vw, 22vw"
                    className="h-auto w-full rounded-[12.4%/5.7%]"
                  />
                </div>
                <CardCaption
                  lead={t(`${phone.id}.lead`)}
                  rest={t(`${phone.id}.rest`)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
