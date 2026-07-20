import type { Metadata, Viewport } from 'next';
import {
  Be_Vietnam_Pro,
  DM_Sans,
  Fraunces,
  Geist,
  Geist_Mono,
  Lora,
} from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { ServiceWorkerRegister } from '@/components/app/shell/service-worker-register';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { routing } from '@/i18n/navigation';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['vietnamese', 'latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'optional',
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
});

// DM Sans ships no Vietnamese subset on Google Fonts (adding a 'vietnamese'
// subset is a build error), so vi diacritics would otherwise fall back
// per-glyph to a system font mid-word. Be Vietnam Pro is a near-identical
// geometric sans WITH full Vietnamese coverage; it is wired into the
// --font-dm-sans fallback chain (see globals.css) so only the glyphs DM Sans
// lacks resolve here — the Latin body keeps DM Sans intact.
const viSans = Be_Vietnam_Pro({
  variable: '--font-vi-sans',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  // Cream canvas, light-only. The product ships a single warm theme; the prior
  // white / near-black status-bar zone framed the cream paper incorrectly in
  // standalone PWA.
  themeColor: '#f9f9f7',
  viewportFit: 'cover',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    return {};
  }

  const t = await getTranslations({
    locale,
    namespace: 'metadata.root',
  });

  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    manifest: '/manifest.webmanifest',
    openGraph: {
      // No shared `url` here: child pages (e.g. /privacy, /terms) would inherit
      // the locale-root URL as their canonical. Pages that need a canonical set
      // their own openGraph.url.
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale,
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/og-image.png'],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Kallo',
    },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${dmSans.variable} ${viSans.variable} ${fraunces.variable} antialiased`}
      >
        <div className="noise-bg pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay" />
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
        <Toaster />
        {/* Registers the offline SW only when NEXT_PUBLIC_ENABLE_SW=true;
            defaults off so it can never white-screen production. */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
