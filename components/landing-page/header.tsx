'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { Button } from '@/components/ui/button';
import { useHeaderOverFooter } from '@/hooks/landing/use-header-over-footer';
import { useHeaderScrolled } from '@/hooks/landing/use-header-scrolled';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import { AppStoreButton } from './app-store-button';
import { AUTH_CTAS_LIVE } from './cta-hold';
import { LocaleSwitcher } from './locale-switcher';
import { scrollToAnchorId } from './scroll-to-anchor';
import { ThemeSwitcher } from './theme-switcher';

/** The one in-page section. Pricing and Docs are routes. */
const ANCHORS = [{ id: 'features', key: 'features' }] as const;

const NAV_LINK =
  'font-sans-display text-kallo-text text-sm transition-colors hover:text-kallo-text/70';

/**
 * `standalone` is for the headers that are NOT on the landing page — /pricing
 * today. The anchors above are in-page scrolls there and dead links here:
 * `scrollToAnchorId` returns early when the element is missing, so "Why text"
 * on /pricing would swallow the click and read as a broken page. When
 * standalone they become locale-aware links back to the landing section, which
 * is where the reader was trying to go.
 */
export function Header({ standalone = false }: { standalone?: boolean } = {}) {
  const t = useTranslations('landing.header');
  const { openDialog } = useAuthDialog();
  const headerRef = useRef<HTMLElement>(null);
  const overFooter = useHeaderOverFooter(headerRef);
  const scrolled = useHeaderScrolled();

  const scrollToAnchor =
    (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      scrollToAnchorId(id);
    };

  return (
    <header
      // Drops in with CSS (`animate-header-drop`, globals.css), so it is in
      // the server's HTML rather than waiting for JS to fade it in.
      // No fill, so the page runs up behind it; the blur keeps the nav
      // readable over scrolled content. The fill comes back only over the
      // footer, which in Light is the same ink as the header's type. From
      // `md` the bar below carries its own blur and fill once scrolled, and
      // this box stays clear and lets clicks through around it.
      ref={headerRef}
      className={cn(
        'fixed top-0 right-0 left-0 z-50 animate-header-drop transition-colors md:pointer-events-none',
        scrolled
          ? 'backdrop-blur-xl md:backdrop-blur-none'
          : standalone && 'backdrop-blur-xl',
        overFooter && 'bg-kallo-surface/80 md:bg-transparent'
      )}
    >
      {/* At rest it matches the section measure below it. On desktop it
          lifts off into a floating bar as soon as the page moves. */}
      <div
        className={cn(
          'mx-auto flex max-w-[86rem] items-center justify-between px-6 py-5 motion-reduce:transition-none sm:px-12 md:pointer-events-auto md:border md:border-transparent md:transition-[max-width,margin,padding,border-radius,border-color,background-color,box-shadow] md:duration-300 md:ease-out',
          scrolled
            ? 'md:mt-3 md:max-w-[min(60rem,calc(100%-2rem))] md:rounded-2xl md:border-kallo-text/10 md:bg-kallo-surface/80 md:px-5 md:py-2 md:shadow-lg md:backdrop-blur-xl'
            : 'lg:px-20'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2">
          <KalloWordmark className="h-5 w-auto text-kallo-text" />
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-8 md:flex">
          {ANCHORS.map((anchor) =>
            standalone ? (
              <Link
                key={anchor.id}
                href={`/#${anchor.id}`}
                className={NAV_LINK}
              >
                {t(anchor.key)}
              </Link>
            ) : (
              <a
                key={anchor.id}
                href={`#${anchor.id}`}
                onClick={scrollToAnchor(anchor.id)}
                className={NAV_LINK}
              >
                {t(anchor.key)}
              </a>
            )
          )}
          <Link href="/pricing" className={NAV_LINK}>
            {t('pricing')}
          </Link>
          <Link href="/docs/overview" className={NAV_LINK}>
            {t('docs')}
          </Link>
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <LocaleSwitcher />
          </div>
          <Button
            variant="landing-ghost"
            className="hidden font-sans-display sm:block"
            disabled={!AUTH_CTAS_LIVE}
            onClick={() => openDialog('sign-in')}
          >
            {t('signIn')}
          </Button>
          <AppStoreButton compact />
        </div>
      </div>
    </header>
  );
}
