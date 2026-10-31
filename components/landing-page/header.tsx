'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { KalloWordmark } from '@/components/brand/kallo-wordmark';
import { Button } from '@/components/ui/button';
import { useHeaderOverFooter } from '@/hooks/landing/use-header-over-footer';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import { AUTH_CTAS_LIVE } from './cta-hold';
import { LocaleSwitcher } from './locale-switcher';
import { scrollToAnchorId } from './scroll-to-anchor';
import { ThemeSwitcher } from './theme-switcher';

/** The two in-page sections. Docs is a route, so it isn't in here. */
const ANCHORS = [
  { id: 'why', key: 'why' },
  { id: 'pricing', key: 'pricing' },
] as const;

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

  const scrollToAnchor =
    (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      scrollToAnchorId(id);
    };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      // No fill, so the page runs up behind it; the blur keeps the nav
      // readable over scrolled content. The fill comes back only over the
      // footer, which in Light is the same ink as the header's type.
      ref={headerRef}
      className={cn(
        'fixed top-0 right-0 left-0 z-50 backdrop-blur-xl transition-colors',
        overFooter && 'bg-kallo-surface/80'
      )}
    >
      {/* Matches the section measure below it, so the wordmark sits on the
          same left edge as the first meal card and the first plan. */}
      <div className="mx-auto flex max-w-[92rem] items-center justify-between px-6 py-5 sm:px-12 lg:px-20">
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
          {/* Black, not the brown `header-cta`. This page is black and white
              throughout: the waitlist pill, every plan button, and this. */}
          <Button
            variant="landing-ink"
            size="header"
            // Tighter on phones, where the label shares one row with the
            // wordmark and both switchers. Under 400px even that is short of
            // the full label (measured at 360px: ~144px free, 165px needed),
            // so those widths get the short one.
            className="whitespace-nowrap px-3.5 font-sans-display text-[13px] sm:px-6 sm:text-sm"
            disabled={!AUTH_CTAS_LIVE}
            onClick={() => openDialog('sign-up')}
          >
            <span className="min-[400px]:hidden">{t('getStartedShort')}</span>
            <span className="hidden min-[400px]:inline">{t('getStarted')}</span>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
