'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/core/ui/cn';

const APP_STORE_URL =
  'https://apps.apple.com/us/app/kallo-nutrition-tracker/id6775761392';

/**
 * Apple's own badge artwork with its outline filled in: black on light themes,
 * white on dark, in the visitor's language. `compact` is the header's size, 40px tall, the
 * smallest Apple allows on screen.
 */
export function AppStoreButton({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('landing.appStore');
  const language = useLocale() === 'vi' ? 'vi-vn' : 'en-us';
  const height = compact ? 'h-10' : 'h-14';
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const badge = (color: 'black' | 'white', visibility: string) => (
    <Image
      src={`/landing/app-store/${color}-${language}.svg`}
      alt=""
      width={120}
      height={40}
      unoptimized
      // Lazy at first, so the colour this theme hides is not fetched during
      // the first load. Eager once hydrated, so it is ready before a switch.
      loading={hydrated ? 'eager' : 'lazy'}
      className={cn(height, 'w-auto', visibility)}
    />
  );

  return (
    <a
      href={APP_STORE_URL}
      aria-label={t('label')}
      className={cn(
        'inline-block shrink-0 rounded-lg transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-text/40',
        className
      )}
    >
      {badge('black', 'block dark:hidden')}
      {badge('white', 'hidden dark:block')}
    </a>
  );
}
